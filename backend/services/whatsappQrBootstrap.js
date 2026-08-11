"use strict";

/**
 * whatsappQrBootstrap.js — MedLeads-specific wiring for the standalone
 * `whatsapp-qr` module. This is the ONLY file that knows about both the
 * generic QR transport AND the MedLeads AI/CRM pipeline.
 *
 * accountId === tenant_id (the clinic's user id). Inbound WhatsApp messages
 * arriving over a QR-linked session are funneled into the SAME pipeline the
 * Meta webhook uses (intent → lead upsert → conversation → AI reply → notify),
 * then the reply is sent back over the same QR session.
 *
 * Instagram is never referenced here.
 *
 * To remove the Meta WhatsApp webhook later, you can simply stop registering
 * the /api/webhooks/whatsapp routes — this path is fully independent.
 */

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const OpenAI = require("openai");

const { createWhatsAppQr } = require("../whatsapp-qr");
const { AISetting, Lead, Conversation, Message, Plan, WhatsAppSession } = require("../models");
const webhook = require("../controllers/webhookController");
const {
  upsertInboundLeadFromMessage,
  getPinnedIntent,
  enforceLeadScoreStageConsistency,
} = require("./leadAutomation");
const { rephraseFAQAnswer } = require("./aiPhrasing");
const { getCreditStatus, consumeCredit } = require("./creditService");
const { canAddNewSlot, getNumberLimitStatus } = require("./whatsappNumberLimitService");
const { sendIntentNotification } = require("./emailService");
const { createNotification } = require("./notificationService");
const { getSelfChatPrompt, getSuperAdminAICredentials } = require("../utils/platformAISettings");
const { isImageAttachment, isVideoAttachment, guessMimeType, localFaqAttachmentPath, buildFaqMessageAttachment } = require("../utils/faqAttachment");
const { extractPhotoGuideMarker, photoGuideExists, photoGuideFileName, photoGuideMime, readPhotoGuideBuffer, buildPhotoGuideMessageAttachment } = require("../utils/photoGuide");
const { transcribeVoice, synthesizeVoice } = require("../utils/voiceAI");
const { detectDeferRequest, scheduleDeferredReply, clearDeferredReply } = require("./deferredReplyService");
const { updateChatSummary } = require("./chatSummaryService");
const log = require("../utils/logger");

const MODULE = "WhatsAppQR";

// ── Composite accountId ───────────────────────────────────────────────────
// A clinic can link MORE THAN ONE WhatsApp number. Each number is a "slot"
// (1, 2, …). The Baileys transport keys sessions by a single accountId string,
// so we encode both parts as `${tenantId}:${slot}`. Inbound/CRM logic strips
// the slot back to the plain tenantId; outbound picks the slot to send from.
//
// NOTE: this is now the hard TECHNICAL ceiling on slot numbers (a real
// Baileys/session-manager resource limit, decoupled from billing) — NOT the
// billing-tier cap anymore. The actual per-tenant billing cap comes from
// Plan.max_whatsapp_numbers / User.feature_overrides via
// whatsappNumberLimitService (see canAddNewSlot / getNumberLimitStatus
// below). Even "unlimited"-plan tenants cannot exceed this constant.
const MAX_SLOTS_PER_TENANT = 5;

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

// Resolve the OpenAI key the same way generateAIResponse does: tenant's own key,
// else the super-admin/platform key. Returns null when none is configured.
async function resolveOpenAIKey(setting) {
  let apiKey = setting?.openai_api_key || null;
  if (!apiKey) {
    const sa = await getSuperAdminAICredentials();
    if (sa?.apiKey) apiKey = sa.apiKey;
  }
  return apiKey;
}

// Credit-usage alerts (75/90/100%) — including the WhatsApp self-chat notice
// when credits run out — are now handled centrally by creditAlertService at
// the moment a credit is consumed, so the inbound path no longer notifies here.

// ─────────────────────────────────────────────────────────────────────────
// SELF-CHAT PROMPT — used ONLY for "Message Yourself" messages (when the
// patient/sender number is the SAME as the connected clinic number). Normal
// patient chats keep using the tenant's configured prompt.
//
// This prompt is NO LONGER hard-coded here. It is managed by the super admin
// in Global AI Settings (PlatformAISetting.self_chat_prompt) and fetched at
// reply time via getSelfChatPrompt(), so it applies to all tenants/customers
// and can be changed without a code deploy.
// ─────────────────────────────────────────────────────────────────────────
// SELF-CHAT COMMAND LAYER
// The self-chat doubles as a CONTROL panel: the clinic owner types a command
// and the system EXECUTES it against the DB, then confirms. This is a small
// extensible registry — add a new entry to support a new command. Each command:
//   match(text) -> params | null     (decide if this command applies)
//   run(params, ctx) -> string       (do the action, return the reply text)
// If no command matches, the self-chat falls back to the normal AI reply.
// ─────────────────────────────────────────────────────────────────────────
// LLM-based intent classifier so the switch/pause command works in ANY
// language (the regex below only catches English). Returns "human" | "ai" |
// null, where null means "this is not a mode-switch request" → fall through to
// the normal AI reply.
async function classifySwitchModeIntent(text, setting) {
  // Resolve the OpenAI key the SAME way generateAIResponse does: prefer the
  // tenant's own key, else fall back to the super-admin/platform key. Without
  // this fallback, tenants who rely on the platform key (no own key) could
  // never use non-English switch commands, since this classifier is the only
  // path for them. Returns null only when no key exists anywhere.
  let apiKey = setting?.openai_api_key || null;
  let model = setting?.openai_model || null;
  if (!apiKey) {
    const sa = await getSuperAdminAICredentials();
    if (sa.apiKey) {
      apiKey = sa.apiKey;
      model = model || sa.model;
    }
  }
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "A clinic staff member sent a WhatsApp note that mentions a patient's phone number. " +
            "The message can be in ANY language. Decide what they want for that patient's chat. " +
            'Answer with EXACTLY one lowercase word and nothing else: ' +
            '"human" = pause/stop/disable the AI, take over manually, or hand the chat to a human agent; ' +
            '"ai" = resume/enable/turn the AI bot back on; ' +
            '"none" = the message is not about switching between AI and human handling.',
        },
        { role: "user", content: text },
      ],
      max_tokens: 3,
      temperature: 0,
    });
    const ans = (completion.choices[0]?.message?.content || "").toLowerCase().trim();
    if (ans.startsWith("human")) return "human";
    if (ans.startsWith("ai")) return "ai";
    return null;
  } catch (err) {
    log.warn(MODULE, "classifySwitchModeIntent", { error: err.message });
    return null;
  }
}

// Translate a fixed English command confirmation into the SAME language the
// staff member wrote in. The command-result strings are hard-coded English, so
// without this a Turkish (or any non-English) command would get an English
// confirmation. Phone number + emoji are preserved. Falls back to the original
// English text if no key is available or the call fails.
async function localizeSelfReply(reply, originalText, setting) {
  try {
    let apiKey = setting?.openai_api_key || null;
    let model = setting?.openai_model || null;
    if (!apiKey) {
      const sa = await getSuperAdminAICredentials();
      if (sa.apiKey) {
        apiKey = sa.apiKey;
        model = model || sa.model;
      }
    }
    if (!apiKey) return reply;
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You localize a fixed confirmation message. First detect the language of the user's message by " +
            "considering the WHOLE message together — not any single word in isolation (words like \"pause\", " +
            "\"ai\", \"ok\", or a phone number exist in many languages and must not decide the language on their own). " +
            "GUARD: if the user's message is in English, or you are not confident about the language, output the " +
            "confirmation in English EXACTLY as given. Otherwise translate the confirmation into that detected " +
            "language. Keep any emoji and the phone number exactly as-is. Output ONLY the message, nothing else.",
        },
        { role: "user", content: `User's message: ${originalText}\n\nConfirmation to localize: ${reply}` },
      ],
      max_tokens: 120,
      temperature: 0,
    });
    const out = completion.choices[0]?.message?.content?.trim();
    return out || reply;
  } catch (err) {
    log.warn(MODULE, "localizeSelfReply", { error: err.message });
    return reply;
  }
}

const SELF_COMMANDS = [
  {
    name: "switch_mode",
    // "switch ai to human for 917984303086", "pause ai for 9779...", "enable ai for ..."
    match: (text) => {
      const t = (text || "").toLowerCase();
      const phone = (text.match(/\d{8,15}/) || [])[0] || null;
      if (!phone) return null;
      // Determine the TARGET direction. Both "ai" and "human" can appear in the
      // same sentence ("switch ai mode to human", "switch human to ai"), so we
      // must read the target — what comes after "to" — first, then fall back to
      // unambiguous action verbs, then a bare noun.
      let mode = null;
      if (/\bto\s+human\b/.test(t)) mode = "human";
      else if (/\bto\s+(ai|bot)\b/.test(t)) mode = "ai";
      else if (/\b(pause|stop|disable|manual|hold|takeover|take\s*over|off)\b/.test(t)) mode = "human";
      else if (/\b(resume|enable|start|automatic|auto|on)\b/.test(t)) mode = "ai";
      else if (/\bhuman\b/.test(t)) mode = "human";
      else if (/\b(ai|bot)\b/.test(t)) mode = "ai";
      // mode may stay null when the message is in another language — we still
      // return the phone so run() can fall back to the LLM classifier. Carry
      // the original text along for that classification.
      return { phone, mode, text };
    },
    run: async ({ phone, mode, text }, { tenantId, setting }) => {
      // English fast-path missed → classify the intent in any language.
      if (!mode) mode = await classifySwitchModeIntent(text, setting);
      // Not actually a switch request (e.g. a reminder that just contains a
      // number) → return null so the normal AI reply handles it.
      if (!mode) return null;
      // A phone can have MORE than one matching lead — e.g. a stale soft-deleted
      // duplicate alongside the live one. Fetch all candidates (live only) and
      // pick the one that actually has a live conversation, so the command never
      // lands on a dead lead and reports a false "no conversation found".
      const candidates = await Lead.findAll({
        where: {
          // Only consider leads that still exist. A soft-deleted duplicate must
          // never be selected — its conversations are deleted too, which would
          // wrongly yield "no conversation found" while the live lead is ignored.
          is_deleted: false,
          // Scope to this tenant by EITHER column: some leads carry the owner in
          // `tenant_id`, others only in `created_by` (the other may be blank).
          // Matching both avoids a false "no conversation found" when one is null.
          [Op.and]: [
            { [Op.or]: [{ tenant_id: tenantId }, { created_by: tenantId }] },
            {
              [Op.or]: [
                { phone },
                { phone: { [Op.like]: `%${phone}` } },
                { notes: { [Op.iLike]: `%${phone}%` } },
              ],
            },
          ],
        },
        // Deterministic order: active leads first, then most recently created.
        order: [["is_active", "DESC"], ["created_at", "DESC"]],
      });
      if (!candidates.length) return await localizeSelfReply(`❌ No conversation found for ${phone}.`, text, setting);
      // Walk candidates and use the first that has at least one live conversation.
      let convs = [];
      for (const candidate of candidates) {
        const found = await Conversation.findAll({
          where: { lead_id: candidate.id, is_deleted: false },
        });
        if (found.length) {
          convs = found;
          break;
        }
      }
      if (!convs.length) return await localizeSelfReply(`❌ No conversation found for ${phone}.`, text, setting);
      const aiEnabled = mode === "ai";
      for (const c of convs) {
        c.ai_enabled = aiEnabled;
        await c.save();
      }
      const reply = aiEnabled
        ? `✅ AI mode ENABLED for ${phone}. The bot will auto-reply again.`
        : `✅ Switched to HUMAN for ${phone}. AI is paused — your team will handle this chat.`;
      return await localizeSelfReply(reply, text, setting);
    },
  },
];

/** Parse + run a self-chat command. Returns the reply text, or null if the
 *  message isn't a recognized command (so normal AI handling continues). */
async function handleSelfCommand(text, ctx) {
  for (const cmd of SELF_COMMANDS) {
    let params = null;
    try {
      params = cmd.match(text);
    } catch (_) {
      params = null;
    }
    if (params) {
      try {
        return await cmd.run(params, ctx);
      } catch (err) {
        log.error(MODULE, "selfCommand", { command: cmd.name, error: err.message });
        return `⚠️ Could not run that command (${cmd.name}). Please try again.`;
      }
    }
  }
  return null;
}

// ─── Photo-batch debounce (per conversation) for the QR channel ───────────
// WhatsApp delivers each photo of a multi-photo send as a SEPARATE inbound
// message, so without batching the AI replies once per photo (4 photos → 4
// messages). Buffer images arriving within QR_PHOTO_BATCH_DELAY_MS for a
// conversation, then produce ONE combined AI evaluation. This mirrors
// scheduleBatchedPhotoReply in webhookController (Meta / Instagram path).
const QR_PHOTO_BATCH_DELAY_MS = 3500;
const qrPhotoBatchMap = new Map(); // conversationId → { timer, images[] }

function scheduleBatchedQrPhotoReply({ conversationId, tenantId, acctId, leadId, jid, images, setting }) {
  const existing = qrPhotoBatchMap.get(conversationId);
  const mergedImages = existing ? [...existing.images, ...images] : [...images];
  // A new photo arrived before the window closed — reset the timer so all
  // photos of the same send are collapsed into a single reply.
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(async () => {
    qrPhotoBatchMap.delete(conversationId);
    try {
      const [conversation, lead] = await Promise.all([
        Conversation.findByPk(conversationId),
        leadId ? Lead.findByPk(leadId) : Promise.resolve(null),
      ]);
      if (!conversation || !conversation.ai_enabled) return;

      const aiRespondsTo = setting.ai_responds_to_intents || ["low", "medium", "high"];
      const intent = conversation.intent || "low";
      if (!aiRespondsTo.includes(intent)) return;

      // Re-check credits at flush time — the batch waited QR_PHOTO_BATCH_DELAY_MS,
      // so the balance may have changed since scheduling.
      const { exhausted } = await getCreditStatus(tenantId);
      if (exhausted) {
        log.warn(MODULE, "photoBatch:creditExhausted", { tenantId, conversationId });
        return;
      }

      // History = everything up to and including the last AI message so the
      // batched photo placeholders don't appear as duplicate user turns.
      const allMessages = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [["created_at", "ASC"]],
        attributes: ["sender_type", "text", "metadata"],
      });
      let lastAiIdx = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i].sender_type === "ai") { lastAiIdx = i; break; }
      }
      const history = lastAiIdx >= 0 ? allMessages.slice(0, lastAiIdx + 1) : [];

      // Empty text (not an English sentence) so generateAIResponse treats this
      // as a photo-only turn and replies in the conversation's language.
      const aiInputText = "";
      // Tenant's own personal prompt if set; otherwise platform default.
      const promptOverride = setting.prompt_instructions || null;
      // Rolling memory (same as the text path) so the post-photo reply keeps
      // earlier collected facts and the conversation language.
      const chatSummary = await updateChatSummary({ conversation, fullHistory: history, setting });
      // toolContext enables the booking tool loop inside webhook.generateAIResponse
      // (see BOOKING_TOOLS/TOOL_HANDLERS, issue #40/#41) — same shape as the
      // Instagram/Web Chat call sites, built from already-in-scope server state.
      const toolContext = { tenantId, leadId: leadId || null, conversationId };
      // Strip any stray photo-guide marker — this is a post-photo reply, so the
      // guide itself is never sent here, but the marker must never reach the patient.
      const aiText = extractPhotoGuideMarker(
        await webhook.generateAIResponse(aiInputText, intent, setting, history, mergedImages, promptOverride, "", chatSummary, toolContext)
      ).text;

      await Message.create({
        conversation_id: conversationId,
        sender_type: "ai",
        sender_id: null,
        receiver_id: null,
        receiver_type: "patient",
        text: aiText,
        metadata: { intent, auto_reply: true, source: "qr", photo_batch: true, photo_count: mergedImages.length },
      });

      // Photo analysis is never a booking confirmation — no won-promotion here.
      try {
        if (aiText && whatsappQr) {
          await whatsappQr.sendText(acctId || makeAccountId(tenantId, 1), jid, aiText);
          // One batched photo evaluation = one AI reply = 1 credit.
          await consumeCredit(tenantId);
          log.info(MODULE, "photoBatch:reply", { tenantId, conversationId, photoCount: mergedImages.length });
        }
      } catch (sendErr) {
        log.error(MODULE, "photoBatch:sendFailed", { tenantId, to: jid, error: sendErr.message });
      }

      conversation.last_message_at = new Date();
      await conversation.save();
    } catch (err) {
      log.error(MODULE, "photoBatch:flush", { error: err.message, conversationId });
    }
  }, QR_PHOTO_BATCH_DELAY_MS);

  qrPhotoBatchMap.set(conversationId, { timer, images: mergedImages });
}

const UPLOAD_SUBDIR = path.join(__dirname, "..", "uploads", "whatsapp-qr");
const PORT_AUTH_DIR = path.join(__dirname, "..", ".wa-sessions");

if (!fs.existsSync(UPLOAD_SUBDIR)) fs.mkdirSync(UPLOAD_SUBDIR, { recursive: true });

// Created lazily so we can reference `whatsappQr` inside the onMessage closure.
let whatsappQr = null;

/** Persist an inbound image to /uploads and return an attachment in the shape
 *  generateAIResponse() expects (kind/url/file_name/mime_type/size). */
async function saveInboundImage(message) {
  try {
    const { buffer, mimeType } = await message.downloadImage();
    const ext = (mimeType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
    const fileName = `waqr_${message.id || "img"}_${buffer.length}.${ext}`;
    const abs = path.join(UPLOAD_SUBDIR, fileName);
    fs.writeFileSync(abs, buffer);
    return {
      kind: "image",
      url: `/uploads/whatsapp-qr/${fileName}`,
      file_name: fileName,
      mime_type: mimeType,
      size: buffer.length,
    };
  } catch (err) {
    log.warn(MODULE, "saveInboundImage", { error: err.message });
    return null;
  }
}

/** Persist a voice note / audio buffer (inbound or AI-synthesized) to /uploads
 *  and return an attachment record (kind "audio"). */
function saveAudioBuffer(buffer, mimeType, messageId) {
  try {
    const mt = String(mimeType || "").toLowerCase();
    const ext = mt.includes("ogg") || mt.includes("opus")
      ? "ogg"
      : mt.includes("mpeg") || mt.includes("mp3")
      ? "mp3"
      : mt.includes("mp4") || mt.includes("m4a") || mt.includes("aac")
      ? "m4a"
      : "ogg";
    const fileName = `waqr_${messageId || "aud"}_${buffer.length}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_SUBDIR, fileName), buffer);
    return {
      kind: "audio",
      url: `/uploads/whatsapp-qr/${fileName}`,
      file_name: fileName,
      mime_type: mimeType || "audio/ogg; codecs=opus",
      size: buffer.length,
    };
  } catch (err) {
    log.warn(MODULE, "saveInboundAudio", { error: err.message });
    return null;
  }
}

/** Find or create the single lead-LESS "self" conversation for a tenant. Used
 *  for "Message Yourself" chats so they appear in the inbox WITHOUT creating a
 *  lead in the CRM pipeline. */
async function getOrCreateSelfConversation(tenantId) {
  let conversation = await Conversation.findOne({
    where: { tenant_id: tenantId, channel: "WhatsApp", lead_id: null, is_deleted: false },
  });
  if (!conversation) {
    conversation = await Conversation.create({
      lead_id: null,
      tenant_id: tenantId,
      channel: "WhatsApp",
      status: "open",
      intent: "unknown",
      ai_enabled: true,
      unread_count: 0,
      last_message_at: new Date(),
    });
    // log.info(MODULE, "getOrCreateSelfConversation", { created: true, tenantId });
  }
  return conversation;
}

/** Core inbound handler — mirrors webhookController.whatsappReceive's per-message
 *  loop, but for a QR-linked session. accountId is `${tenantId}:${slot}`. */
async function handleInbound(accountId, message) {
  const { tenantId, slot } = parseAccountId(accountId);
  // Transport is keyed by the composite accountId, so every send in this inbound
  // context must target `acctId` (this exact number/slot), not a bare tenantId.
  const acctId = makeAccountId(tenantId, slot);
  const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
  if (!setting) return;
  if (setting.whatsapp_enabled === false) return;

  const fromPhone = String(message.from).replace(/\D/g, "");

  // Dedupe — the same message id is never processed twice.
  if (message.id) {
    const dup = await Message.findOne({
      where: { metadata: { [Op.contains]: { whatsapp_message_id: message.id } } },
    });
    if (dup) return;
  }

  // Resolve text + (optional) image / voice attachment.
  let text = message.text || "";
  const attachments = [];
  let isVoiceInbound = false;
  if (message.hasImage && typeof message.downloadImage === "function") {
    const att = await saveInboundImage(message);
    if (att) attachments.push(att);
  }
  // Voice note / audio: download once, save it, and transcribe so the AI can
  // understand what the patient said. The transcript becomes the message text.
  if (message.hasAudio && typeof message.downloadAudio === "function") {
    try {
      const { buffer, mimeType } = await message.downloadAudio();
      const att = saveAudioBuffer(buffer, mimeType, message.id);
      if (att) {
        attachments.push(att);
        isVoiceInbound = true;
      }
      if (!text && buffer) {
        const apiKey = await resolveOpenAIKey(setting);
        if (apiKey) {
          try {
            const transcript = await transcribeVoice({ apiKey, buffer, mimeType });
            if (transcript) text = transcript;
          } catch (tErr) {
            log.warn(MODULE, "voiceTranscribe", { error: tErr.message });
          }
        }
      }
    } catch (aErr) {
      log.warn(MODULE, "inboundAudio", { error: aErr.message });
    }
  }
  if (!text && attachments.length === 0) return;

  // Shown in the chat/lead when there is no text (e.g. transcription failed).
  const placeholderText = isVoiceInbound ? "[voice message]" : "[image]";

  const detectedIntent = webhook.analyzeIntent(text, setting);
  const isSelfChat = message.isSelfChat === true;

  // Self-chat ("Message Yourself") must NOT create a lead — it is an internal
  // thread. It gets a dedicated lead-less conversation instead. All lead-bound
  // automation below is skipped when `lead` is null.
  let lead = null;
  let conversation;
  if (isSelfChat) {
    conversation = await getOrCreateSelfConversation(tenantId);
  } else {
    ({ lead } = await upsertInboundLeadFromMessage({
      tenantId,
      channel: "WhatsApp",
      primaryIdentifier: fromPhone,
      fallbackName: message.pushName || null,
      text: text || placeholderText,
      intent: detectedIntent,
      hasAttachments: attachments.length > 0,
    }));

    // Display the real phone number on the lead when WhatsApp reveals it (via
    // key.senderPn). We keep matching/dedup on `fromPhone` (the stable LID), so
    // this only improves what's SHOWN — it never creates a duplicate lead.
    if (message.phoneNumber && /^\d{6,}$/.test(message.phoneNumber) && lead.phone !== message.phoneNumber) {
      try {
        lead.phone = message.phoneNumber;
        await lead.save();
      } catch (e) {
        log.warn(MODULE, "setLeadPhone", { error: e.message });
      }
    }

    conversation = await webhook.getOrCreateConversation(lead, "WhatsApp", tenantId);
  }

  await Message.create({
    conversation_id: conversation.id,
    sender_type: "patient",
    sender_id: null,
    receiver_id: null,
    receiver_type: "user",
    // Voice notes display as the audio player only — the transcript is kept in
    // metadata (for AI/search/records) but never shown as chat text.
    text: isVoiceInbound ? "" : (text || placeholderText),
    attachments,
    metadata: { whatsapp_message_id: message.id, from: fromPhone, source: "qr", self_chat: message.isSelfChat === true, message_type: message.type, ...(isVoiceInbound && text ? { transcript: text } : {}) },
  });

  conversation.unread_count += 1;
  conversation.last_message_at = new Date();
  conversation.last_patient_message_at = new Date();
  // Remember the exact JID this message arrived on so follow-ups / deferred
  // callbacks (which run outside the live inbound context) reply to the SAME
  // address. Sending to "<phone>@s.whatsapp.net" for a LID contact silently
  // fails — this is why follow-ups weren't being delivered.
  if (message.jid && conversation.channel_thread_id !== message.jid) {
    conversation.channel_thread_id = message.jid;
  }
  // Remember which linked number (slot) this chat is on so outbound replies
  // (AI, manual, follow-ups) go back out the SAME number the patient messaged.
  if (conversation.wa_slot !== slot) {
    conversation.wa_slot = slot;
  }

  const intent = getPinnedIntent(conversation.intent, detectedIntent);
  conversation.intent = intent;

  // Patient is active again — cancel any pending "message me later" callback.
  if (!isSelfChat) await clearDeferredReply(conversation);

  // ── "Message me later" (deferred callback) ──
  // If the patient says they're busy and to reach out after a short delay,
  // acknowledge, arm the callback, and skip the normal AI reply this turn.
  if (!isSelfChat && text && conversation.ai_enabled) {
    const defer = await detectDeferRequest({ text, setting });
    if (defer.defer) {
      await scheduleDeferredReply(conversation, defer.minutes, text);
      const { exhausted } = await getCreditStatus(tenantId);
      if (!exhausted) {
        await Message.create({
          conversation_id: conversation.id,
          sender_type: "ai",
          sender_id: null,
          receiver_id: null,
          receiver_type: "patient",
          text: defer.ack,
          metadata: { source: "qr", deferred_ack: true, snooze_minutes: defer.minutes },
        });
        try {
          await whatsappQr.sendText(acctId, message.jid, defer.ack);
          await consumeCredit(tenantId);
        } catch (sendErr) {
          log.error(MODULE, "deferAck:sendFailed", { error: sendErr.message });
        }
      }
      conversation.last_message_at = new Date();
      await conversation.save();
      return; // handled — the re-engagement will be sent when the timer elapses
    }
  }

  // ── Self-chat command layer ──
  // In the self-chat, a message may be a CONTROL command (e.g. "switch ai to
  // human for 9179..."). If it is, execute it and reply with confirmation —
  // skip the normal AI reply for this turn.
  if (isSelfChat && text) {
    const commandReply = await handleSelfCommand(text, { tenantId, setting });
    if (commandReply) {
      await Message.create({
        conversation_id: conversation.id,
        sender_type: "ai",
        sender_id: null,
        receiver_id: null,
        receiver_type: "patient",
        text: commandReply,
        metadata: { source: "qr", self_chat: true, command: true },
      });
      try {
        await whatsappQr.sendText(acctId, message.jid, commandReply);
      } catch (sendErr) {
        log.error(MODULE, "selfCommand:sendFailed", { error: sendErr.message });
      }
      await conversation.save();
      return; // command handled — do not run the generic AI reply
    }
  }

  const aiRespondsTo = setting.ai_responds_to_intents || ["low", "medium", "high"];
  const emailNotifyFor = setting.email_notify_intents || ["high"];

  // A caption-less image-only message. Multi-photo sends arrive as several of
  // these back-to-back, so they are batched into ONE combined AI reply instead
  // of a separate assessment per photo. Voice notes and self-chat are excluded.
  const batchableImages = attachments.filter((a) => a.kind === "image" && a.url);
  const isPureImageMessage =
    !text &&
    !isVoiceInbound &&
    !isSelfChat &&
    batchableImages.length > 0 &&
    attachments.every((a) => a.kind === "image" && a.url);

  if (conversation.ai_enabled && aiRespondsTo.includes(intent)) {
    // Credit check (shared policy, incl. 500 trial cap).
    const { exhausted: creditsExhausted, creditLimit, creditsUsed } = await getCreditStatus(tenantId);

    if (creditsExhausted) {
      log.warn(MODULE, "creditExhausted", { tenantId, creditsUsed, creditLimit });
      // The owner was already alerted when usage crossed 100% (creditAlertService
      // fires on the consuming reply); we just skip the AI reply here.
    } else if (isPureImageMessage) {
      // Defer + batch: wait for the rest of the photos in this send, then reply
      // once. conversation.save() below persists intent before the timer fires.
      scheduleBatchedQrPhotoReply({
        conversationId: conversation.id,
        tenantId,
        acctId,
        leadId: lead?.id || null,
        jid: message.jid,
        images: batchableImages,
        setting,
      });
    } else {
      try {
        const allHistory = await Message.findAll({
          where: { conversation_id: conversation.id },
          order: [["created_at", "ASC"]],
          attributes: ["sender_type", "text", "metadata"],
        });
        const history = allHistory.slice(0, -1); // exclude the just-saved patient turn
        const imageAttachments = attachments.filter((a) => a.kind === "image" && a.url);
        // A voice note that Whisper could not transcribe. We must NOT put an
        // English instruction sentence in aiInputText — that would become the
        // "current message" and bias the reply to English. Keep the turn text
        // empty (language stays anchored to history) and drive the ask via a
        // per-turn hint below instead.
        const voiceUnreadable = !text && imageAttachments.length === 0 && isVoiceInbound;
        const aiInputText = text
          ? text
          : imageAttachments.length > 0
          ? "" // photo-only turn — empty so the reply keeps the conversation language
          : voiceUnreadable
          ? "" // unreadable voice — empty so the reply keeps the conversation language
          : text;
        // Self-chat uses a dedicated prompt and skips FAQ matching so the
        // custom prompt fully governs the reply. Normal patient chats are
        // unchanged.
        const faqMatch = isSelfChat ? null : await webhook.matchFAQ(aiInputText, tenantId);
        const faqAnswer = faqMatch?.answer || null;
        const faqAttachments = faqMatch?.attachments || [];
        const promptOverride = isSelfChat
          ? (await getSelfChatPrompt()) || null
          // Tenant's own personal prompt if set; otherwise platform default.
          : (setting.prompt_instructions || null);
        // Voice notes are transcribed by Whisper, which tends to normalise
        // Moroccan Darija toward Modern Standard Arabic. Give the model the
        // spoken-dialect signal it otherwise loses so it replies in the SAME
        // dialect the patient spoke (Darija stays Darija, not MSA). Voice-only.
        const voiceDialectHint = isVoiceInbound && text
          ? 'VOICE MESSAGE — CRITICAL FOR THIS TURN: The patient\'s message is a transcribed voice note, so its wording may have been auto-normalised toward Modern Standard Arabic. Detect the ACTUAL spoken dialect and reply in THAT dialect. If the transcript shows Moroccan Arabic (Darija) markers (e.g. "bghit", "bzaf", "dyal", "wach", "kayn", "daba", "mzyan", "3afak"), reply in Moroccan Darija — NOT Modern Standard Arabic. Never answer in a different dialect than the one the patient spoke.'
          : "";
        // Unreadable voice note: instruct the model to ask for a resend, but in
        // the patient's OWN language (taken from history) — never English.
        const voiceUnreadableHint = voiceUnreadable
          ? "THIS TURN: The patient sent a voice message that could not be understood/transcribed. In the patient's OWN language (use the conversation history above to determine it — NEVER default to English), warmly and briefly ask them to resend the voice note or type their question instead. Do not continue the booking flow this turn."
          : "";
        const perTurnHint = [voiceDialectHint, voiceUnreadableHint].filter(Boolean).join("\n\n");
        // Rolling memory: fold everything older than the last 5 messages into a
        // running summary so collected facts (name, date, etc.) survive after they
        // leave the recent-message window. Only used for the generated-reply path.
        const chatSummary = faqMatch
          ? ""
          : await updateChatSummary({ conversation, fullHistory: history, setting });
        // toolContext enables the booking tool loop inside webhook.generateAIResponse
        // (see BOOKING_TOOLS/TOOL_HANDLERS, issue #40/#41). Self-chat has no real
        // `lead` (it's the clinic owner's own test thread — see isSelfChat above),
        // so booking tools are only offered for real patient conversations, same
        // as Instagram/Web Chat always having a concrete leadId.
        const toolContext = isSelfChat ? null : { tenantId, leadId: lead?.id || null, conversationId: conversation.id };
        let aiText = faqMatch
          ? (faqAnswer ? await rephraseFAQAnswer({ patientText: aiInputText, faqAnswer, intent, aiSettings: setting, conversationHistory: history }) : "")
          : await webhook.generateAIResponse(aiInputText, intent, setting, history, imageAttachments, promptOverride, perTurnHint, chatSummary, toolContext);

        // Photo-guide: the AI emits [[PHOTO_GUIDE]] on the FIRST photo request
        // only. Strip it from the reply and, when present, attach the fixed
        // guide image once (never re-sent on later photo-related messages).
        const { text: strippedText, sendGuide } = extractPhotoGuideMarker(aiText);
        aiText = strippedText;
        const attachPhotoGuide = sendGuide && photoGuideExists();

        // If the patient sent a voice note, synthesize the spoken reply up-front
        // so we can BOTH show it as a voice message in the chat AND send it over
        // WhatsApp. If synthesis fails we fall back to a plain text reply below.
        let aiVoice = null; // { buffer, mimetype, seconds, attachment }
        if (aiText && isVoiceInbound) {
          try {
            const apiKey = await resolveOpenAIKey(setting);
            if (apiKey) {
              const { buffer, mimetype, seconds } = await synthesizeVoice({ apiKey, text: aiText });
              const attachment = saveAudioBuffer(buffer, mimetype, `ai_${message.id || conversation.id}`);
              if (attachment) aiVoice = { buffer, mimetype, seconds, attachment };
            }
          } catch (voiceErr) {
            log.warn(MODULE, "aiReply:voiceFailed", { tenantId, error: voiceErr.message });
          }
        }

        await Message.create({
          conversation_id: conversation.id,
          sender_type: "ai",
          sender_id: null,
          receiver_id: null,
          receiver_type: "patient",
          // Voice reply displays as the audio player only — transcript kept in metadata.
          text: aiVoice ? "" : (aiText || (faqAttachments.length ? "[Attachment]" : aiText)),
          attachments: [
            ...(aiVoice ? [aiVoice.attachment] : []),
            ...faqAttachments.map(buildFaqMessageAttachment),
            ...(attachPhotoGuide ? [buildPhotoGuideMessageAttachment()] : []),
          ],
          metadata: { intent, auto_reply: true, faq_matched: !!faqMatch, faq_attachments: faqAttachments.length ? faqAttachments : undefined, source: "qr", self_chat: isSelfChat, ...(aiVoice ? { voice_reply: true, transcript: aiText } : {}) },
        });

        if (lead) {
          const refreshedLead = await Lead.findByPk(lead.id);
          await webhook.maybeMarkLeadWonFromConfirmation({ lead: refreshedLead, conversation, text: aiText });
        }

        // Send the reply back over the QR session. CRITICAL: reply to the exact
        // JID the message arrived on (message.jid) — modern WhatsApp addresses
        // contacts by LID ("<id>@lid"), not "<phone>@s.whatsapp.net". Rebuilding
        // the JID from a bare number sends to a non-existent recipient, so the
        // reply is saved in the DB but never delivered. message.jid is LID-safe.
        try {
          if (aiText) {
            // Send the reply as a voice note when we synthesized one above; fall
            // back to text if synthesis was unavailable or the voice send fails,
            // so the patient always gets an answer.
            let voiceReplySent = false;
            if (aiVoice) {
              try {
                await whatsappQr.sendMedia(acctId, message.jid, {
                  buffer: aiVoice.buffer,
                  isVoice: true,
                  mimetype: aiVoice.mimetype,
                  seconds: aiVoice.seconds,
                });
                voiceReplySent = true;
              } catch (voiceErr) {
                log.warn(MODULE, "aiReply:voiceSendFailed", { tenantId, error: voiceErr.message });
              }
            }
            if (!voiceReplySent) {
              await whatsappQr.sendText(acctId, message.jid, aiText);
            }
          }
          // Deliver each FAQ attachment (image / video / document) alongside the answer.
          for (const att of faqAttachments) {
            try {
              const buffer = fs.readFileSync(localFaqAttachmentPath(att));
              await whatsappQr.sendMedia(acctId, message.jid, {
                buffer,
                isImage: isImageAttachment(att),
                isVideo: isVideoAttachment(att),
                fileName: path.basename(att),
                mimetype: guessMimeType(att),
              });
            } catch (mediaErr) {
              log.error(MODULE, "aiReply:attachmentFailed", { tenantId, attachment: att, error: mediaErr.message });
            }
          }
          // Deliver the fixed photo-guide image once, when the marker was present.
          if (attachPhotoGuide) {
            try {
              await whatsappQr.sendMedia(acctId, message.jid, {
                buffer: readPhotoGuideBuffer(),
                isImage: true,
                fileName: photoGuideFileName(),
                mimetype: photoGuideMime(),
              });
            } catch (guideErr) {
              log.error(MODULE, "aiReply:photoGuideFailed", { tenantId, error: guideErr.message });
            }
          }
          await consumeCredit(tenantId);
        } catch (sendErr) {
          log.error(MODULE, "aiReply:sendFailed", {
            tenantId,
            to: message.jid,
            error: sendErr.message,
          });
        }

        if (intent === "low" && setting.escalate_low_confidence) conversation.status = "pending";
      } catch (aiErr) {
        log.error(MODULE, "ai", { error: aiErr.message });
      }
    }
  }

  // Email / in-app notification for configured intents — lead chats only.
  // Self-chat is internal, so it never raises lead notifications.
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
        body: `${lead?.name || "A patient"} sent a ${intent}-intent message via WhatsApp. Review recommended.`,
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
  // log.info(MODULE, "inbound", { tenantId, leadId: lead?.id || null, selfChat: isSelfChat, conversationId: conversation.id });
}

/** Initialize the QR channel and mount its REST routes. Call once at startup. */
function mountWhatsAppQr(app, { authMiddleware } = {}) {
  // The portable whatsapp-qr module logs console-style: logger.info(msg, data).
  // MedLeads' logger is logger.info(module, action, data). Adapt between them so
  // the payload (incl. real error messages) is preserved instead of becoming
  // "[object Object]".
  const moduleLogger = {
    // INFO logs silenced to keep the console quiet. warn/error still surface so
    // real failures remain visible. Re-enable info for debugging if needed.
    info: () => {},
    warn: (msg, data) => log.warn(MODULE, msg, data || {}),
    error: (msg, data) => log.error(MODULE, msg, data || {}),
  };

  // Upsert the per-(tenant, slot) connection status row that the UI reads.
  const upsertSessionState = async (accountId, patch) => {
    const { tenantId, slot } = parseAccountId(accountId);
    if (!Number.isFinite(tenantId)) return;
    try {
      const [row] = await WhatsAppSession.findOrCreate({
        where: { tenant_id: tenantId, slot },
        defaults: { tenant_id: tenantId, slot },
      });
      await row.update(patch);
    } catch (err) {
      log.warn(MODULE, "upsertSessionState", { accountId, error: err.message });
    }
  };

  whatsappQr = createWhatsAppQr({
    authDir: PORT_AUTH_DIR,
    logger: moduleLogger,
    onMessage: handleInbound,
    onConnected: async (accountId, number) => {
      await upsertSessionState(accountId, { status: "connected", number });
    },
    onDisconnected: async (accountId, info) => {
      await upsertSessionState(accountId, { status: info?.loggedOut ? "logged_out" : "disconnected" });
    },
  });

  // resolveAccountId FORCES the tenant to the logged-in user (a clinic can only
  // touch its OWN sessions) and reads the SLOT from the URL param, so
  // POST /api/whatsapp-qr/2/connect links the tenant's 2nd number.
  const resolveAccountId = (req) => {
    const tenantId = req.user?.tenant_id || req.user?.id;
    if (!tenantId) return null;
    const slot = normalizeSlot(req.params.accountId);
    return makeAccountId(tenantId, slot);
  };

  // Plan-limit capacity check for NEW slot connections. Must be registered
  // BEFORE the portable whatsapp-qr router below — Express matches routes in
  // registration order, so this explicit handler for the exact
  // method+path (POST .../:accountId/connect) fires first and either
  // short-circuits with a 403 (at capacity, net-new slot) or calls next() to
  // fall through to the portable router's own /connect handler. It never
  // shadows status/qr/logout (different methods/paths).
  //
  // This cannot live inside resolveAccountId: that function is shared
  // (synchronously) by ALL four portable routes and can only return an
  // accountId string or falsy — it cannot carry a structured 403 payload,
  // and gating it would incorrectly also block status/qr polling.
  app.post("/api/whatsapp-qr/:accountId/connect", authMiddleware, async (req, res, next) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return next(); // let the portable router's own guard handle it

      const slot = normalizeSlot(req.params.accountId);
      const existingRow = await WhatsAppSession.findOne({ where: { tenant_id: tenantId, slot } });
      const allowed = await canAddNewSlot(tenantId, { existingRow: !!existingRow });
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You've reached your plan's WhatsApp number limit. Upgrade your plan to connect more numbers.",
          code: "PLAN_LIMIT_REACHED",
          feature: "max_whatsapp_numbers",
        });
      }
      return next();
    } catch (err) {
      log.error(MODULE, "planLimitCheck", { error: err.message });
      return next(); // fail open — never block a connect attempt on our own error
    }
  });

  app.use(
    "/api/whatsapp-qr",
    whatsappQr.router({ authMiddleware, resolveAccountId })
  );

  // Build the { sessions, maxSlots } payload for a tenant — merges live
  // in-memory status (authoritative for qr_pending/connecting) over the
  // persisted row so the UI reflects the socket's real state. Shared by the
  // /sessions GET and the /:accountId/remove DELETE so both routes never drift.
  const buildSessionsPayload = async (tenantId) => {
    const rows = await WhatsAppSession.findAll({
      where: { tenant_id: tenantId },
      order: [["slot", "ASC"]],
    });
    const sessions = rows.map((r) => {
      const live = whatsappQr.getStatus(makeAccountId(tenantId, r.slot));
      return {
        slot: r.slot,
        label: r.label,
        status: live?.status || r.status,
        number: live?.number || r.number,
      };
    });
    // maxSlots reflects the tenant's real plan-derived limit and is passed
    // through AS-IS, including null for "unlimited" (Enterprise) plans.
    // MAX_SLOTS_PER_TENANT is NOT substituted here — it is purely an internal
    // technical ceiling (enforced separately by normalizeSlot() and the
    // connect-route capacity check below), not the tenant-facing cap. Leaking
    // it into maxSlots would make an unlimited plan look like a hard cap of 5
    // to the frontend. frontend/src/components/integrations/
    // WhatsAppMultiConnect.tsx already branches on `maxSlots ? "X of Y used" :
    // "X connected"`, so a falsy (null) maxSlots here renders correctly with
    // no frontend change needed.
    const { limit } = await getNumberLimitStatus(tenantId);
    return { sessions, maxSlots: limit, used: rows.length };
  };

  // List all linked-number slots for the logged-in tenant (drives the multi-
  // session UI). Mounted after the portable router so it shares the auth mw.
  app.get("/api/whatsapp-qr/sessions", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });
      const payload = await buildSessionsPayload(tenantId);
      return res.json({ success: true, ...payload });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Permanently remove a WhatsApp number slot — deletes the DB row entirely
  // (unlike logout, which only marks the row disconnected and keeps it).
  // Blocked when the slot is currently connected (must disconnect first) or
  // when it is the tenant's last remaining slot (at least one must remain).
  app.delete("/api/whatsapp-qr/:accountId/remove", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No account" });

      const slot = normalizeSlot(req.params.accountId);
      const row = await WhatsAppSession.findOne({ where: { tenant_id: tenantId, slot } });

      const accountId = makeAccountId(tenantId, slot);
      const live = whatsappQr.getStatus(accountId);
      if (live?.status === "connected") {
        return res.status(409).json({
          success: false,
          message: "Disconnect this WhatsApp number before removing it.",
        });
      }

      // A slot the tenant has never connected has no DB row yet — it's still a
      // real card in the UI, so removing it is a no-op success, not a 404.
      //
      // NOTE: there used to be a blanket "at least one slot must always
      // remain" rule here (block removal once totalSlots <= 1). That rule
      // predates per-plan number limits (issue #46) and made sense only when
      // every tenant had the same flat MAX_SLOTS_PER_TENANT cap with no way
      // to change which number they used other than logout/reconnect on the
      // same slot. Now that a 1-number-plan tenant can legitimately have
      // exactly one slot total, that old rule permanently traps them: once
      // they disconnect their only number, they can never remove it (to free
      // the slot for a *different* number) because totalSlots is still 1.
      // Removing a slot never leaves the tenant with fewer DB rows than
      // WhatsAppSession structurally requires (zero is a valid, already-
      // handled state — it's exactly what a brand-new tenant looks like
      // before their first-ever connect), so there is no structural reason
      // to keep this floor. The only real invariant worth enforcing is "you
      // can't remove a slot that's currently connected" (checked above) —
      // removing down to zero slots is safe and is the correct way for a
      // 1-slot-plan tenant to swap to a different WhatsApp number.
      if (row) {
        await whatsappQr.removeSlot(accountId);
        await WhatsAppSession.destroy({ where: { tenant_id: tenantId, slot } });
      }

      const payload = await buildSessionsPayload(tenantId);
      return res.json({ success: true, removedSlot: slot, ...payload });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Re-link any previously connected sessions after a server restart. Session
  // folders are named "<tenant>_<slot>", so restoreAll re-keys them correctly.
  whatsappQr.restoreAll();

  // log.info(MODULE, "mounted", { route: "/api/whatsapp-qr" });
  return whatsappQr;
}

/** Resolve which slot a conversation's replies should go out on. */
function slotForConversation(conversation) {
  return normalizeSlot(conversation?.wa_slot || 1);
}

/** Send a WhatsApp text over a tenant's QR-linked session. `slot` selects which
 *  linked number (defaults to 1). Used by the CRM (manual replies, in-app AI
 *  replies, follow-ups) so outbound goes out the same number as inbound. */
async function sendWhatsAppText(tenantId, toNumberOrJid, text, slot = 1) {
  if (!whatsappQr) throw new Error("WhatsApp QR channel not initialized");
  return whatsappQr.sendText(makeAccountId(tenantId, slot), toNumberOrJid, text);
}

/** Send a WhatsApp media attachment over a tenant's QR-linked session.
 *  `media` = { buffer, isImage, fileName, mimetype, caption }. `slot` selects
 *  which linked number (defaults to 1). */
async function sendWhatsAppMedia(tenantId, toNumberOrJid, media, slot = 1) {
  if (!whatsappQr) throw new Error("WhatsApp QR channel not initialized");
  return whatsappQr.sendMedia(makeAccountId(tenantId, slot), toNumberOrJid, media);
}

module.exports = { mountWhatsAppQr, handleInbound, sendWhatsAppText, sendWhatsAppMedia, slotForConversation };
