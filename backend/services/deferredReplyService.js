const { Op } = require("sequelize");
const OpenAI = require("openai");
const { Conversation, Message, Lead, AISetting } = require("../models");
const { getCreditStatus, consumeCredit } = require("./creditService");
const { getSuperAdminAICredentials } = require("../utils/platformAISettings");
const { deliverText } = require("./channelDelivery");
const { getLastPatientLanguageSample } = require("../utils/aiLanguage");
const log = require("../utils/logger");

const MODULE = "DeferredReply";

// Honour a genuine "message me in one minute" request. The deferred-callback
// poller (processDeferredCallbacks) runs every 60s, so a 1-minute snooze fires
// on the next tick — roughly 1–2 minutes out, as promised to the patient.
const MIN_MINUTES = 1;
const MAX_MINUTES = 24 * 60; // longer requests are left to the day-based follow-ups
const DEFAULT_MINUTES = 15;

// Tenant key first, then super-admin/platform key (same policy as the AI reply).
async function resolveOpenAIKey(setting) {
  let apiKey = setting?.openai_api_key || null;
  if (!apiKey) {
    const sa = await getSuperAdminAICredentials();
    if (sa?.apiKey) apiKey = sa.apiKey;
  }
  return apiKey;
}

const clampMinutes = (n) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, v));
};

/**
 * Decide whether the patient is asking to be contacted later, extract the
 * delay in minutes, and produce a short acknowledgement in their language.
 * Works in any language via the LLM; returns { defer:false } when no key.
 * @returns {Promise<{defer:boolean, minutes?:number, ack?:string}>}
 */
async function detectDeferRequest({ text, setting }) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { defer: false };

  const apiKey = await resolveOpenAIKey(setting);
  if (!apiKey) return { defer: false };

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: setting?.openai_model || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You analyse ONE message a patient sent to a medical clinic chat. The message may be in ANY language. " +
            "Decide if the patient is saying they are BUSY / not free right now and wants to be contacted again LATER " +
            "after a short delay (e.g. \"I'm busy, message me in 10-15 minutes\", \"call me back in an hour\", \"text me later\"). " +
            "Respond ONLY with a JSON object: {\"defer\": boolean, \"minutes\": number|null, \"ack\": string}. " +
            "Rules: defer=true ONLY for an explicit request to be contacted later; otherwise defer=false. " +
            "minutes = the requested delay in minutes (for a range like 10-15 use the LARGER number; null if not stated). " +
            "ack = a short, warm one-sentence acknowledgement confirming you'll reach out again after that time " +
            "(empty string when defer=false).\n" +
            "LANGUAGE — CRITICAL: The \"ack\" MUST be written in the SAME language as the patient's message below, and in NO other language. " +
            "First identify the language of the patient's message, then write the ack ONLY in that language. " +
            "If the message is in English, the ack MUST be in English. If Arabic, ack in Arabic. If Turkish, ack in Turkish. " +
            "NEVER answer in Spanish (or any other language) unless the patient's message itself is in that language.",
        },
        { role: "user", content: `Patient's message (write the ack in THIS message's language):\n"""\n${trimmed}\n"""` },
      ],
      max_tokens: 150,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    if (!parsed || parsed.defer !== true) return { defer: false };
    return {
      defer: true,
      minutes: clampMinutes(parsed.minutes == null ? DEFAULT_MINUTES : parsed.minutes),
      ack: (parsed.ack && String(parsed.ack).trim()) || "Sure — I'll check back with you shortly. 😊",
    };
  } catch (err) {
    log.warn(MODULE, "detectDeferRequest", { error: err.message });
    return { defer: false };
  }
}

/** Arm a deferred callback on the conversation. Overwrites any pending one. */
async function scheduleDeferredReply(conversation, minutes, note) {
  const mins = clampMinutes(minutes);
  conversation.snooze_until = new Date(Date.now() + mins * 60 * 1000);
  conversation.snooze_note = (note || "").slice(0, 1000);
  conversation.snooze_sent = false;
  await conversation.save();
  log.info(MODULE, "scheduleDeferredReply", { conversationId: conversation.id, minutes: mins });
}

/** Clear a pending callback — call when the patient becomes active again. */
async function clearDeferredReply(conversation) {
  if (conversation.snooze_until && !conversation.snooze_sent) {
    conversation.snooze_until = null;
    conversation.snooze_note = null;
    await conversation.save();
  }
}

// Craft the re-engagement message sent when the delay elapses.
async function generateReengagement({ setting, history, leadName, note }) {
  const name = leadName && !String(leadName).startsWith("+") ? leadName : "there";
  const apiKey = await resolveOpenAIKey(setting);
  if (!apiKey) {
    return `Hi ${name}, following up as you asked — are you free now to continue? I'm happy to help whenever you're ready. 😊`;
  }
  try {
    const openai = new OpenAI({ apiKey });
    const historyLines = (history || [])
      .slice(-8)
      .filter((m) => m.text)
      .map((m) => `${m.sender_type === "patient" ? "Patient" : "Clinic"}: ${m.text}`)
      .join("\n");
    // Pin the re-engagement to the patient's own language via an explicit
    // sample (same approach as the day-based follow-up) — relying on the model
    // to "scan history" let non-English patients receive an English message.
    const langSample = getLastPatientLanguageSample(history);
    const languageLock = langSample
      ? `\n- LANGUAGE — CRITICAL: Write the ENTIRE message in the SAME language as the patient. Their language is exactly that of this message they sent — reply ONLY in that language: "${langSample}". Never default to English.`
      : `\n- LANGUAGE — CRITICAL: Write the message in the same language the patient has been using in the conversation above. Never default to English.`;
    const prompt = `You are a medical clinic assistant. Earlier the patient said they were busy and asked to be contacted again shortly. That time has now passed, so gently re-open the conversation.
Patient name: ${leadName || "Unknown"}
What they were discussing: ${note || "(their earlier enquiry)"}
Recent conversation:
${historyLines || "(no messages yet)"}

Write a warm, non-pushy message (2-3 sentences, no markdown), acknowledging they asked to be reached now and inviting them to continue.${languageLock}`;
    const completion = await openai.chat.completions.create({
      model: setting.openai_model || "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 160,
      temperature: 0.7,
    });
    return (
      completion.choices[0]?.message?.content?.trim() ||
      `Hi ${name}, checking back as you asked — shall we continue? 😊`
    );
  } catch (err) {
    log.error(MODULE, "generateReengagement", { error: err.message });
    return `Hi ${name}, following up as you asked — I'm here whenever you're ready to continue. 😊`;
  }
}

/**
 * Minute-poller: send re-engagement messages for conversations whose snooze
 * window has elapsed and the patient hasn't come back. DB-backed so it survives
 * restarts; snooze_sent guards against double-sends.
 */
async function processDeferredCallbacks() {
  try {
    const now = new Date();
    const due = await Conversation.findAll({
      where: {
        is_deleted: false,
        ai_enabled: true,
        snooze_sent: false,
        snooze_until: { [Op.ne]: null, [Op.lte]: now },
        status: { [Op.in]: ["open", "pending"] },
        channel: { [Op.in]: ["WhatsApp", "Instagram"] },
      },
      include: [
        {
          model: Lead,
          required: true,
          where: { is_deleted: false, stage: { [Op.notIn]: ["lost", "won"] } },
        },
      ],
    });

    for (const conversation of due) {
      try {
        const lead = conversation.Lead;
        const tenantId = conversation.tenant_id;
        const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
        if (!setting) continue;

        // If the patient replied after the snooze was armed, skip (they're active).
        if (
          conversation.last_patient_message_at &&
          conversation.snooze_until &&
          new Date(conversation.last_patient_message_at) > new Date(conversation.snooze_until)
        ) {
          conversation.snooze_until = null;
          conversation.snooze_note = null;
          await conversation.save();
          continue;
        }

        const { exhausted } = await getCreditStatus(tenantId);
        if (exhausted) {
          // Leave snooze armed; try again next tick once credits are available.
          continue;
        }

        const history = await Message.findAll({
          where: { conversation_id: conversation.id },
          order: [["created_at", "ASC"]],
          limit: 10,
          attributes: ["sender_type", "text"],
        });

        const text = await generateReengagement({
          setting,
          history,
          leadName: lead.name,
          note: conversation.snooze_note,
        });

        const sent = await deliverText({ conversation, setting, lead, text });
        if (!sent) {
          // Couldn't deliver (e.g. session down) — clear so it doesn't loop forever.
          conversation.snooze_sent = true;
          await conversation.save();
          log.warn(MODULE, "processDeferredCallbacks:notSent", { conversationId: conversation.id });
          continue;
        }

        await Message.create({
          conversation_id: conversation.id,
          sender_type: "ai",
          sender_id: null,
          receiver_id: null,
          receiver_type: "patient",
          text,
          metadata: { deferred_callback: true },
        });

        conversation.snooze_sent = true;
        conversation.last_message_at = new Date();
        await conversation.save();
        await consumeCredit(tenantId);

        log.info(MODULE, "processDeferredCallbacks:sent", { conversationId: conversation.id, channel: conversation.channel });
      } catch (innerErr) {
        log.error(MODULE, "processDeferredCallbacks:item", { conversationId: conversation.id, error: innerErr.message });
      }
    }
  } catch (err) {
    log.error(MODULE, "processDeferredCallbacks", { error: err.message });
  }
}

module.exports = {
  detectDeferRequest,
  scheduleDeferredReply,
  clearDeferredReply,
  processDeferredCallbacks,
};
