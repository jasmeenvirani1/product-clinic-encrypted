"use strict";

/**
 * instagramDmBootstrap.js — MedLeads-specific wiring for the standalone
 * `instagram-dm` module. This is the ONLY file that knows about both the
 * generic Instagram DM transport AND the MedLeads AI/CRM pipeline.
 *
 * accountId === `${tenantId}:${slot}` (same composite convention as
 * whatsappQrBootstrap.js). Inbound Instagram DMs arriving over a linked
 * session are funneled into the SAME pipeline the WhatsApp-QR channel uses
 * (intent → lead upsert → conversation → AI reply), then the reply is sent
 * back over the same Instagram session.
 *
 * WhatsApp is never referenced here.
 */

const path = require("path");
const { Op } = require("sequelize");

const { createInstagramDm } = require("../instagram-dm");
const { AISetting, Lead, Conversation, Message, InstagramSession } = require("../models");
const webhook = require("../controllers/webhookController");
const {
  upsertInboundLeadFromMessage,
  getPinnedIntent,
  enforceLeadScoreStageConsistency,
} = require("./leadAutomation");
const { getCreditStatus, consumeCredit } = require("./creditService");
const { sendIntentNotification } = require("./emailService");
const { createNotification } = require("./notificationService");
const { ingestFromUrl } = require("./mediaIngest");
const { updateChatSummary } = require("./chatSummaryService");
const log = require("../utils/logger");

const MODULE = "InstagramDM";

// ── Composite accountId ───────────────────────────────────────────────────
// Kept parameterized for parity with WhatsApp's multi-slot pattern, though
// only slot 1 is exposed in the UI today (one IG account per tenant).
const MAX_SLOTS_PER_TENANT = 1;

const makeAccountId = (tenantId, slot = 1) => `${Number(tenantId)}:${Number(slot) || 1}`;

const parseAccountId = (accountId) => {
  const [t, s] = String(accountId).split(":");
  return { tenantId: Number(t), slot: Number(s) || 1 };
};

// Normalize a slot from an untrusted request param → 1..MAX_SLOTS_PER_TENANT.
const normalizeSlot = (raw) => {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_SLOTS_PER_TENANT);
};

const AUTH_DIR = path.join(__dirname, "..", ".ig-sessions");

// Created lazily so we can reference `instagramDm` inside the onMessage closure.
let instagramDm = null;

/** Core inbound handler — mirrors whatsappQrBootstrap.handleInbound's shape,
 *  but for an Instagram-DM-linked session. accountId is `${tenantId}:${slot}`. */
async function handleInbound(accountId, message) {
  const { tenantId, slot } = parseAccountId(accountId);
  const acctId = makeAccountId(tenantId, slot);
  const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
  if (!setting) return;
  if (setting.instagram_enabled === false) return;

  // Dedupe — the same DM item id is never processed twice.
  if (message.id) {
    const dup = await Message.findOne({
      where: { metadata: { [Op.contains]: { instagram_message_id: message.id } } },
    });
    if (dup) return;
  }

  let text = message.text || "";
  const attachments = [];
  if (message.mediaUrl) {
    const kindHint = message.type === "audio" ? "audio" : "image";
    const att = await ingestFromUrl({
      tenantId,
      fileUrl: message.mediaUrl,
      fileName: `ig_${message.id || "media"}`,
      kindHint,
    });
    if (att) attachments.push(att);
  }
  if (!text && attachments.length === 0) return;

  const placeholderText = attachments.some((a) => a.kind === "image") ? "[image]" : "[attachment]";

  const detectedIntent = webhook.analyzeIntent(text, setting);

  const { lead } = await upsertInboundLeadFromMessage({
    tenantId,
    channel: "Instagram",
    primaryIdentifier: message.from,
    fallbackName: null,
    text: text || placeholderText,
    intent: detectedIntent,
    hasAttachments: attachments.length > 0,
  });

  const conversation = await webhook.getOrCreateConversation(lead, "Instagram", tenantId);

  await Message.create({
    conversation_id: conversation.id,
    sender_type: "patient",
    sender_id: null,
    receiver_id: null,
    receiver_type: "user",
    text: text || placeholderText,
    attachments,
    metadata: { instagram_message_id: message.id, from: message.from, source: "ig-dm" },
  });

  conversation.unread_count += 1;
  conversation.last_message_at = new Date();
  conversation.last_patient_message_at = new Date();
  // Remember the exact thread this message arrived on so replies (AI, manual,
  // follow-ups) go back to the SAME Instagram DM thread.
  if (message.threadId && conversation.channel_thread_id !== message.threadId) {
    conversation.channel_thread_id = message.threadId;
  }

  const intent = getPinnedIntent(conversation.intent, detectedIntent);
  conversation.intent = intent;

  const aiRespondsTo = setting.ai_responds_to_intents || ["low", "medium", "high"];
  const emailNotifyFor = setting.email_notify_intents || ["high"];

  if (conversation.ai_enabled && aiRespondsTo.includes(intent)) {
    const { exhausted: creditsExhausted, creditLimit, creditsUsed } = await getCreditStatus(tenantId);

    if (creditsExhausted) {
      log.warn(MODULE, "creditExhausted", { tenantId, creditsUsed, creditLimit });
    } else {
      try {
        const allHistory = await Message.findAll({
          where: { conversation_id: conversation.id },
          order: [["created_at", "ASC"]],
          attributes: ["sender_type", "text", "metadata"],
        });
        const history = allHistory.slice(0, -1); // exclude the just-saved patient turn
        const imageAttachments = attachments.filter((a) => a.kind === "image" && a.url);
        const aiInputText = text || (imageAttachments.length > 0 ? "" : text);

        const faqMatch = await webhook.matchFAQ(aiInputText, tenantId);
        const faqAnswer = faqMatch?.answer || null;
        const faqAttachments = faqMatch?.attachments || [];
        const promptOverride = setting.prompt_instructions || null;
        const chatSummary = faqMatch ? "" : await updateChatSummary({ conversation, fullHistory: history, setting });

        let aiText = faqMatch
          ? faqAnswer || ""
          : await webhook.generateAIResponse(aiInputText, intent, setting, history, imageAttachments, promptOverride, "", chatSummary);

        await Message.create({
          conversation_id: conversation.id,
          sender_type: "ai",
          sender_id: null,
          receiver_id: null,
          receiver_type: "patient",
          text: aiText || (faqAttachments.length ? "[Attachment]" : aiText),
          metadata: { intent, auto_reply: true, faq_matched: !!faqMatch, source: "ig-dm" },
        });

        if (lead) {
          const refreshedLead = await Lead.findByPk(lead.id);
          await webhook.maybeMarkLeadWonFromConfirmation({ lead: refreshedLead, conversation, text: aiText });
        }

        try {
          if (aiText && instagramDm) {
            await instagramDm.sendText(acctId, message.threadId, aiText);
            await consumeCredit(tenantId);
          }
        } catch (sendErr) {
          log.error(MODULE, "aiReply:sendFailed", { tenantId, threadId: message.threadId, error: sendErr.message });
        }

        if (intent === "low" && setting.escalate_low_confidence) conversation.status = "pending";
      } catch (aiErr) {
        log.error(MODULE, "ai", { error: aiErr.message });
      }
    }
  }

  if (lead && emailNotifyFor.includes(intent) && setting.notification_email) {
    try {
      await sendIntentNotification({
        toEmail: setting.notification_email,
        intent,
        leadName: lead.name,
        channel: conversation.channel,
        conversationId: conversation.id,
      });
      await createNotification({
        type: "message",
        title: `${intent.charAt(0).toUpperCase() + intent.slice(1)} intent conversation`,
        body: `${lead?.name || "A patient"} sent a ${intent}-intent message via Instagram. Review recommended.`,
        tenantId: conversation.tenant_id,
        recipientRole: "tenant_admin",
        meta: { conversation_id: conversation.id, lead_id: lead?.id, intent },
      });
    } catch (mailErr) {
      log.error(MODULE, "email", { error: mailErr.message });
    }
  }

  if (lead) await enforceLeadScoreStageConsistency(lead);
  await conversation.save();
}

/** Initialize the Instagram DM channel and mount its REST routes. Call once at startup. */
function mountInstagramDm(app, { authMiddleware } = {}) {
  const moduleLogger = {
    info: () => {},
    warn: (msg, data) => log.warn(MODULE, msg, data || {}),
    error: (msg, data) => log.error(MODULE, msg, data || {}),
  };

  // Upsert the per-(tenant, slot) connection status row that the UI reads.
  const upsertSessionState = async (accountId, patch) => {
    const { tenantId, slot } = parseAccountId(accountId);
    if (!Number.isFinite(tenantId)) return;
    try {
      const [row] = await InstagramSession.findOrCreate({
        where: { tenant_id: tenantId, slot },
        defaults: { tenant_id: tenantId, slot },
      });
      await row.update(patch);
    } catch (err) {
      log.warn(MODULE, "upsertSessionState", { accountId, error: err.message });
    }
  };

  instagramDm = createInstagramDm({
    authDir: AUTH_DIR,
    logger: moduleLogger,
    onMessage: handleInbound,
    onConnected: async (accountId, igUsername) => {
      await upsertSessionState(accountId, { status: "connected", ig_username: igUsername, last_error: null });
    },
    onDisconnected: async (accountId, info) => {
      const status =
        info?.reason === "banned" ? "banned" : info?.reason === "bad_credentials" ? "disconnected" : "disconnected";
      await upsertSessionState(accountId, { status, last_error: info?.error || null });
    },
    onChallenge: async (accountId, info) => {
      const status = info?.kind === "2fa" ? "awaiting_2fa" : "awaiting_challenge";
      const { status: liveStatus, last_error } = instagramDm.getStatus(accountId);
      await upsertSessionState(accountId, { status: liveStatus || status, last_error: last_error || null });
    },
  });

  // resolveAccountId FORCES the tenant to the logged-in user (a clinic can only
  // touch its OWN sessions) and reads the SLOT from the URL param.
  const resolveAccountId = (req) => {
    const tenantId = req.user?.tenant_id || req.user?.id;
    if (!tenantId) return null;
    const slot = normalizeSlot(req.params.accountId);
    return makeAccountId(tenantId, slot);
  };

  app.use(
    "/api/instagram-dm",
    instagramDm.router({ authMiddleware, resolveAccountId })
  );

  // After every connect/submit-code call, mirror the manager's live status
  // into the InstagramSession row so the UI/DB never drift out of sync —
  // wrap the router-mounted routes is not possible here (portable router has
  // no post-hook), so we instead sync the row lazily on GET /sessions and via
  // the emitted lifecycle events registered above.

  // List all linked-account slots for the logged-in tenant (drives the UI).
  app.get("/api/instagram-dm/sessions", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });
      const rows = await InstagramSession.findAll({
        where: { tenant_id: tenantId },
        order: [["slot", "ASC"]],
      });
      const sessions = rows.map((r) => {
        const live = instagramDm.getStatus(makeAccountId(tenantId, r.slot));
        return {
          slot: r.slot,
          label: r.label,
          status: live?.status || r.status,
          ig_username: live?.ig_username || r.ig_username,
        };
      });
      return res.json({ success: true, sessions, maxSlots: MAX_SLOTS_PER_TENANT });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Re-link any previously connected sessions after a server restart.
  instagramDm.restoreAll();

  return instagramDm;
}

/** Resolve which slot a conversation's replies should go out on. Instagram
 *  only supports a single linked account per tenant today (MAX_SLOTS_PER_TENANT
 *  = 1), so this always resolves to slot 1 — kept as a function for parity
 *  with WhatsApp's per-conversation slot and to make future multi-account
 *  support a non-breaking change (would read a dedicated column then). */
function slotForConversation(_conversation) {
  return 1;
}

/** Send an Instagram DM text over a tenant's linked session. `slot` selects
 *  which linked account (defaults to 1). Used by channelService for manual
 *  replies, in-app AI replies, and follow-ups. */
async function sendInstagramText(tenantId, threadIdOrUserId, text, slot = 1) {
  if (!instagramDm) throw new Error("Instagram DM channel not initialized");
  return instagramDm.sendText(makeAccountId(tenantId, slot), threadIdOrUserId, text);
}

module.exports = { mountInstagramDm, handleInbound, sendInstagramText, slotForConversation };
