const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const OpenAI = require("openai");
const { createOpenAI } = require("../utils/openaiClient");
const { Op } = require("sequelize");
const { AISetting, Lead, Conversation, Message, FAQ, User, InstagramSession } = require("../models");
const { processHighIntentCapture } = require("../services/leadCapture");
// Outbound messaging is channel-agnostic — WhatsApp via Baileys/QR, Instagram
// via Meta's official Graph API.
const { sendOutbound } = require("../services/channelService");
const { sendIntentNotification, sendLeadCaptureEscalation, sendNewLeadCreatedEmail } = require("../services/emailService");
const { createNotification } = require("../services/notificationService");
const { triggerLeadSummary } = require("../services/leadSummaryService");
const log = require("../utils/logger");
const { getPlatformPromptInstructions, getPlatformUseCases, buildUseCasesBlock, getSuperAdminAICredentials } = require("../utils/platformAISettings");
const { getLastPatientLanguageSample, buildLanguageInstruction } = require("../utils/aiLanguage");
const { rephraseFAQAnswer } = require("../services/aiPhrasing");
const { ingestWhatsAppMedia, ingestInstagramAttachment } = require("../services/mediaIngest");
const {
  enforceLeadScoreStageConsistency,
  ensureLeadChannelIdentity,
  getPinnedIntent,
  upsertInboundLeadFromMessage,
} = require("../services/leadAutomation");
const { classifyLeadIntent } = require("../services/leadIntentService");

const MODULE = "WebhookController";

// ─── Photo-batch debounce (per conversation) ─────────────────────────────────
// WhatsApp delivers each photo from a multi-photo send as a separate webhook
// event. Buffer images for PHOTO_BATCH_DELAY_MS, then produce one combined AI
// evaluation instead of a separate reply per photo.
const PHOTO_BATCH_DELAY_MS = 3500;
const photoBatchMap = new Map(); // conversationId → { timer, images[] }

const logLeadAutomationDebug = (_label, _details) => {};

// ─── AI helpers (same logic as conversationController) ──────────────

const INTENT_SIGNAL_HIGH = /\b(book|booking|booked|schedule|scheduled|appointment|appointments|slot|visit|come in|consultation|consult|reserve|reserved|confirm|confirmed|asap|urgent|today|tomorrow|right away|immediately|soon)\b/i;
const INTENT_SIGNAL_MEDIUM = /\b(price|pricing|cost|charge|fee|package|quotation|quote|how much|details|detail|information|info|procedure|process|treatment|plan|options|available)\b/i;
// Detects a booking confirmation in ANY language without relying on fixed keywords.
//
// The bot’s FINAL confirmation always wraps the booked slot in single quotes:
//   ‘15 May at 10 AM’   ‘15 Mayıs saat 15:00’   ‘5 January 2026 at 3pm’
//
// Matches a quoted string containing either:
//   • a 4-digit year (2026), OR
//   • a time pattern (10 AM, 3 PM, 15:00, 10:30)
//
// Handles ASCII quotes (' "), smart/curly quotes ('' ""),
// and angle/guillemet quotes (« »  ‹ ›) that AI models sometimes produce.
const QUOTED_SLOT_RE = /['"«‹'"][^'"»›'"]{2,80}(?:\d{4}|\d{1,2}[:.]\d{2}|\d{1,2}\s*(?:am|pm))[^'"»›'"]{0,40}['"»›'"]/i;

const isBookingConfirmationMessage = (text) => {
  if (!text) return false;
  return QUOTED_SLOT_RE.test(text.trim());
};

const maybeMarkLeadWonFromConfirmation = async ({ lead, conversation, text }) => {
  if (!lead || !text) return lead;
  if (lead.stage === "won") return lead;
  const regexMatch = isBookingConfirmationMessage(text);
  const classification = await classifyLeadIntent({
    tenantId: lead.created_by || lead.assigned_to,
    text,
    currentStage: lead.stage || "new",
    currentScore: lead.score || 0,
    fallbackIntent: conversation?.intent || "low",
  });
  // Only the confirmed booking signal counts — booking + positive language is
  // too broad and fires for any AI message that asks about dates ("Great! What
  // day works for you?"). Discussion messages must stay in discussion.
  const aiWonMatch = classification.signals?.hasExplicitWonIntent === true;
  if (!regexMatch && !aiWonMatch) return lead;

  lead.stage = "won";
  lead.score = Math.max(lead.score || 0, classification.recommended?.score || 85, 85);
  await lead.save();
  triggerLeadSummary(lead.id, lead.created_by || lead.assigned_to, {
    intent: conversation.intent || "unknown",
  });
  return lead;
};

// Batches images arriving within PHOTO_BATCH_DELAY_MS of each other for a single
// conversation, then generates one combined AI response when the batch is settled.
const scheduleBatchedPhotoReply = ({ conversationId, tenantId, leadId, channel, recipientId, images, setting }) => {
  const existing = photoBatchMap.get(conversationId);
  const mergedImages = existing ? [...existing.images, ...images] : [...images];
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(async () => {
    photoBatchMap.delete(conversationId);
    try {
      const [conversation, lead] = await Promise.all([
        Conversation.findByPk(conversationId),
        Lead.findByPk(leadId),
      ]);
      if (!conversation || !lead || !conversation.ai_enabled) return;

      const aiRespondsTo = setting.ai_responds_to_intents || ["low", "medium"];
      const intent = conversation.intent || "low";
      if (!aiRespondsTo.includes(intent)) return;

      // History = everything up to and including the last AI message so the
      // batched photos don't appear as duplicate user turns in the prompt.
      const allMessages = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [["created_at", "ASC"]],
        attributes: ["sender_type", "text"],
      });
      let lastAiIdx = -1;
      for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i].sender_type === "ai") { lastAiIdx = i; break; }
      }
      const history = lastAiIdx >= 0 ? allMessages.slice(0, lastAiIdx + 1) : [];

      const aiInputText = "I've sent my photos as you requested. Please go ahead and assess them.";
      const aiText = await generateAIResponse(aiInputText, intent, setting, history, mergedImages);

      await Message.create({
        conversation_id: conversationId,
        sender_type: "ai",
        sender_id: null,
        receiver_id: null,
        receiver_type: "patient",
        text: aiText,
        metadata: { intent, auto_reply: true, photo_batch: true, photo_count: mergedImages.length },
      });

      try {
        await sendOutbound(channel, setting, recipientId, aiText);
        log.info(MODULE, "photoBatch:reply", { channel, to: recipientId, photoCount: mergedImages.length });
      } catch (sendErr) {
        log.warn(MODULE, "photoBatch:reply:notSent", { channel, to: recipientId, error: sendErr.message });
      }
      // Photo analysis is never a booking confirmation — do not attempt won promotion here.
    } catch (err) {
      log.error(MODULE, "photoBatch:flush", { error: err.message, conversationId });
    }
  }, PHOTO_BATCH_DELAY_MS);

  photoBatchMap.set(conversationId, { timer, images: mergedImages });
};

const analyzeIntent = (text, aiSettings) => {
  const lower = (text || "").toLowerCase();
  const high = aiSettings.high_intent_keywords || [];
  const medium = aiSettings.medium_intent_keywords || [];
  if (high.some((s) => lower.includes(s.toLowerCase()))) return "high";
  if (medium.some((s) => lower.includes(s.toLowerCase()))) return "medium";

  // Signal-based fallback: works even when no keywords are configured
  if (INTENT_SIGNAL_HIGH.test(lower)) return "high";
  if (INTENT_SIGNAL_MEDIUM.test(lower)) return "medium";

  return "low";
};

// Returns { answer, attachments } (or null). The object shape is what the
// WhatsApp-QR bootstrap and Meta paths both consume (faqMatch?.answer /
// faqMatch?.attachments).
const matchFAQ = async (text, tenantId) => {
  const faqs = await FAQ.findAll({ where: { tenant_id: tenantId, is_active: true, is_deleted: false } });
  if (!faqs.length) return null;

  const toResult = (faq) => {
    const attachments = Array.isArray(faq.attachments) && faq.attachments.length
      ? faq.attachments.filter(Boolean)
      : (faq.attachment ? [faq.attachment] : []);
    return { answer: faq.answer || null, attachments };
  };

  // 1) Fast path — literal keyword/substring match. Cheap, no API cost.
  const lower = (text || "").toLowerCase();
  for (const faq of faqs) {
    const keywords = faq.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    if (keywords.length > 0 && matchCount / keywords.length >= 0.5) {
      return toResult(faq);
    }
  }

  // 2) Semantic path — LLM classifier so a message in ANY language matches an
  //    FAQ written in another. Falls back to "no match" without a key.
  if (!text || !text.trim()) return null;
  try {
    const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
    let apiKey = setting?.openai_api_key || null;
    let model = setting?.openai_model || null;
    if (!apiKey) {
      const sa = await getSuperAdminAICredentials();
      if (sa?.apiKey) { apiKey = sa.apiKey; model = model || sa.model; }
    }
    if (!apiKey) return null;

    const list = faqs.map((f, i) => `${i + 1}. ${f.question}`).join("\n");
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: model || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You match a patient's message to a list of clinic FAQ questions. The message and the FAQs may be in DIFFERENT " +
            "languages — match by MEANING, not by wording. Reply with ONLY the number of the FAQ that answers the patient's " +
            "message. If none clearly matches, reply with 0.",
        },
        { role: "user", content: `FAQs:\n${list}\n\nPatient message: ${text}\n\nBest matching FAQ number:` },
      ],
      max_tokens: 5,
      temperature: 0,
    });
    const raw = (completion.choices[0]?.message?.content || "").trim();
    const idx = parseInt(raw.match(/\d+/)?.[0] || "0", 10);
    if (idx >= 1 && idx <= faqs.length) return toResult(faqs[idx - 1]);
    return null;
  } catch (err) {
    log.warn(MODULE, "matchFAQ:semantic", { error: err.message });
    return null;
  }
};

const DATE_HINT_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DATE_HINT_DAY_MAP = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const DATE_HINT_MONTH_IDX = { january:0, february:1, march:2, april:3, may:4, june:5, july:6, august:7, september:8, october:9, november:10, december:11 };
const DATE_HINT_RE = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g;

const injectDateHint = (text, now) => {
  if (!text) return text;
  const hints = [];
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d) => `${d.getDate()} ${DATE_HINT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const mkDateHint = (raw, d) => {
    const diff = Math.round((d - todayMidnight) / 86400000);
    if (diff < 0) return `"${raw}" = ${fmt(d)} — PAST DATE (${Math.abs(diff)} days ago), INVALID for booking`;
    if (diff === 0) return `"${raw}" = ${fmt(d)} — TODAY, VALID for booking`;
    return `"${raw}" = ${fmt(d)} — FUTURE DATE (${diff} days from now), VALID for booking`;
  };

  // 1. Explicit DD-MM-YYYY or DD/MM/YYYY
  const explicitRe = new RegExp(DATE_HINT_RE.source, "g");
  let match;
  while ((match = explicitRe.exec(text)) !== null) {
    const [raw, d, m, y] = match;
    const day = parseInt(d, 10), month = parseInt(m, 10), year = parseInt(y, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2020) continue;
    hints.push(mkDateHint(raw, new Date(year, month - 1, day)));
  }

  // 2. Month-name dates: "12 May 2026", "12th May", "May 12, 2026", "May 12"
  const MPAT = "(?:january|february|march|april|may|june|july|august|september|october|november|december)";
  const mnRe1 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MPAT})(?:\\s+(\\d{4}))?\\b`, "gi");
  const mnRe2 = new RegExp(`\\b(${MPAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[,\\s]+(\\d{4}))?\\b`, "gi");
  let mnm;
  while ((mnm = mnRe1.exec(text)) !== null) {
    const day = parseInt(mnm[1], 10);
    const mIdx = DATE_HINT_MONTH_IDX[mnm[2].toLowerCase()];
    let yr = mnm[3] ? parseInt(mnm[3], 10) : now.getFullYear();
    let d = new Date(yr, mIdx, day);
    if (!mnm[3] && d < todayMidnight) { yr++; d = new Date(yr, mIdx, day); }
    if (day < 1 || day > 31) continue;
    hints.push(mkDateHint(mnm[0], d));
  }
  while ((mnm = mnRe2.exec(text)) !== null) {
    const mIdx = DATE_HINT_MONTH_IDX[mnm[1].toLowerCase()];
    const day = parseInt(mnm[2], 10);
    let yr = mnm[3] ? parseInt(mnm[3], 10) : now.getFullYear();
    let d = new Date(yr, mIdx, day);
    if (!mnm[3] && d < todayMidnight) { yr++; d = new Date(yr, mIdx, day); }
    if (day < 1 || day > 31) continue;
    hints.push(mkDateHint(mnm[0], d));
  }

  // 3. "tomorrow" — including common misspellings
  if (/\btom+or+ow?\b/i.test(text)) {
    const d = new Date(todayMidnight); d.setDate(d.getDate() + 1);
    hints.push(`"tomorrow" = ${fmt(d)} — FUTURE DATE (1 day from now), VALID for booking`);
  }

  // 4. "today"
  if (/\btoday\b/i.test(text)) {
    hints.push(`"today" = ${fmt(todayMidnight)} — TODAY, VALID for booking`);
  }

  // 5. "next week" with no specific day — treat as 7 days out
  if (/\bnext\s+week\b/i.test(text) && !/\bnext\s+week\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)) {
    const d = new Date(todayMidnight); d.setDate(d.getDate() + 7);
    hints.push(`"next week" = week of ${fmt(d)} — FUTURE DATE (7 days from now), VALID for booking`);
  }

  // 6. "next month"
  if (/\bnext\s+month\b/i.test(text)) {
    const d = new Date(todayMidnight); d.setMonth(d.getMonth() + 1);
    hints.push(`"next month" = around ${fmt(d)} — FUTURE DATE, VALID for booking`);
  }

  // 7. "in X days" / "in X weeks"
  const inDaysRe = /\bin\s+(\d+|an?)\s+(days?|weeks?)\b/gi;
  let inm;
  while ((inm = inDaysRe.exec(text)) !== null) {
    const n = /^an?$/i.test(inm[1]) ? 1 : parseInt(inm[1], 10);
    const days = inm[2].toLowerCase().startsWith("week") ? n * 7 : n;
    const d = new Date(todayMidnight); d.setDate(d.getDate() + days);
    hints.push(mkDateHint(inm[0], d));
  }

  // 8. Named days: "Monday", "next Monday", "this Monday", "next week Monday"
  const dayRe = /\b(?:(?:next|this)\s+(?:week\s+)?)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  let dayMatch;
  while ((dayMatch = dayRe.exec(text)) !== null) {
    const targetDay = DATE_HINT_DAY_MAP[dayMatch[1].toLowerCase()];
    let diff = targetDay - todayMidnight.getDay();
    if (diff <= 0) diff += 7;
    const d = new Date(todayMidnight); d.setDate(d.getDate() + diff);
    hints.push(`"${dayMatch[0]}" = ${fmt(d)} — FUTURE DATE (${diff} days from now), VALID for booking`);
  }

  // ── Time annotations (only when a date context exists in this message) ──
  if (hints.length > 0) {
    const hasFutureDate = hints.some(h => h.includes("FUTURE DATE"));
    const hasToday      = hints.some(h => h.includes("— TODAY,"));
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const nowStr  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

    const addTimeHint = (rawTime, reqMins) => {
      if (hasFutureDate) {
        hints.push(`"${rawTime}" — TIME VALID (future date, all times valid regardless of current time)`);
      } else if (hasToday) {
        hints.push(reqMins <= nowMins
          ? `"${rawTime}" — TIME INVALID (current time is ${nowStr}, already passed today)`
          : `"${rawTime}" — TIME VALID (today, time is still ahead)`);
      }
    };

    // AM/PM times: "10 AM", "2:30 PM", "10:00am"
    const ampmRe = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
    let tm;
    while ((tm = ampmRe.exec(text)) !== null) {
      let h = parseInt(tm[1], 10);
      const mi = parseInt(tm[2] || "0", 10);
      if (tm[3].toLowerCase() === "pm" && h !== 12) h += 12;
      if (tm[3].toLowerCase() === "am" && h === 12) h = 0;
      addTimeHint(tm[0], h * 60 + mi);
    }

    // 24-hour times: "14:00", "10:30" (colon required to avoid matching plain numbers)
    const h24Re = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
    let hm;
    while ((hm = h24Re.exec(text)) !== null) {
      if (/^\s*(am|pm)\b/i.test(text.slice(hm.index + hm[0].length))) continue; // already caught by ampmRe
      addTimeHint(hm[0], parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10));
    }

    // Vague time words — use typical midpoint for today's check
    if (/\bmorning\b/i.test(text))              addTimeHint("morning",          9 * 60);
    if (/\bafternoon\b/i.test(text))             addTimeHint("afternoon",       13 * 60);
    if (/\b(?:evening|tonight)\b/i.test(text))   addTimeHint("evening/tonight", 18 * 60);
    if (/\bany\s*time\b/i.test(text))
      hints.push(`"anytime" — FLEXIBLE TIME, VALID for booking on any accepted date`);
  }

  if (!hints.length) return text;
  return `${text}\n\n[PARSED DATE/TIME: ${hints.join(" | ")}]`;
};

// 8-arg signature shared by the Meta path AND the WhatsApp-QR bootstrap:
//   (text, intent, aiSettings, history, images, overridePrompt, perTurnHint, chatSummary)
// - overridePrompt: tenant/self-chat prompt override (null → platform default)
// - perTurnHint: per-turn language/dialect/voice hints
// - chatSummary: rolling memory of older turns
const generateAIResponse = async (text, intent, aiSettings, conversationHistory, imageAttachments = [], overridePrompt = null, perTurnHint = "", chatSummary = "") => {
  // Resolve credentials: tenant's own key first, else the super-admin/platform
  // key so AI replies still work for tenants without their own key.
  let apiKey = aiSettings.openai_api_key;
  let model = aiSettings.openai_model || null;
  let baseURL = aiSettings.openai_base_url || null;
  const sa = await getSuperAdminAICredentials();
  if (!apiKey && sa.apiKey) {
    apiKey = sa.apiKey;
    model = model || sa.model;
    baseURL = null; // platform key uses default OpenAI endpoint
  }
  model = model || "gpt-4o";

  if (!apiKey) {
    if (intent === "high") return "Thank you for your interest! I'd love to help you move forward. Could you share your preferred dates and any specific requirements?";
    if (intent === "medium") return "Great question! We offer several treatment options. Would you like me to explain the details or schedule a free consultation?";
    return "Thank you for reaching out! We're here to help whenever you're ready. Feel free to ask any questions.";
  }
  try {
    // overridePrompt (tenant personal / self-chat) wins when provided; else platform default.
    const platformPrompt = overridePrompt != null ? overridePrompt : await getPlatformPromptInstructions();
    const useCases = await getPlatformUseCases();
    const useCasesBlock = buildUseCasesBlock(useCases);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const currentDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const currentTime = now.toTimeString().slice(0, 5);
    const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const humanDate = `${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    const todayDayName = DAY_NAMES[now.getDay()];
    const resolvedPrompt = (platformPrompt || "").replace(/\{\{CURRENT_DATE\}\}/g, currentDate).replace(/\{\{CURRENT_TIME\}\}/g, currentTime);

    const historyLength = conversationHistory ? conversationHistory.length : 0;
    const conversationGuard = historyLength > 0
      ? `CRITICAL RULE: This is an ONGOING conversation with ${historyLength} prior messages. You MUST NOT send the Step 1 opening greeting again. NEVER say "Hi! 😊 Is this for a hair transplant for yourself?" — that was already sent. Read the conversation history below and continue from where it left off.\n\n`
      : "";

    const basePrompt = (resolvedPrompt + useCasesBlock).trim() || "You are a helpful medical clinic assistant.";

    const hasImages = imageAttachments.length > 0;
    const hasCaption = !!(text && String(text).trim());
    const noCurrentText = hasImages && !hasCaption;
    const lastPatientLangSample = getLastPatientLanguageSample(conversationHistory);
    const languageInstruction = buildLanguageInstruction({
      currentText: text,
      languageSample: lastPatientLangSample,
      noCurrentText,
    });
    const photoInstruction = hasImages
      ? `PHOTO ANALYSIS: The patient has sent hair photos which are attached to this message. You CAN see these images. Carefully examine each photo and assess the actual stage of hair loss visible. Look for: hairline recession, crown thinning, temple loss, and overall hair density. Base your Step 6 graft estimate ONLY on what you actually observe in the photos combined with what the patient told you (area, duration, treatments). Do NOT give a generic or random estimate — give one based on what you see.`
      : `PHOTO HANDLING: No images have been provided. If the patient mentions sending photos but no images are attached, ask them to resend. If you see "[image]" in history without actual images now, base your Step 6 assessment solely on what the patient described (area affected, duration, treatments tried).`;

    const dateParsingInstruction = `DATE & DAY PARSING — CRITICAL: Today is ${currentDate} which is ${humanDate} (${todayDayName}). Current time is ${currentTime}. Users commonly write dates as DD-MM-YYYY (e.g. "12-5-2026" = 12 May 2026) or DD/MM/YYYY. ALWAYS interpret user-provided dates as DD-MM-YYYY format. Compare actual calendar dates — NOT strings. A date is VALID if it falls on or after ${humanDate} — this explicitly includes TODAY (${humanDate}).\n\nRELATIVE DATE CALCULATION: When the user says a relative day (e.g. "next Monday", "next week Monday", "tomorrow"), calculate the exact calendar date based on today being ${todayDayName} ${humanDate}. Example: if today is Friday 8 May 2026, "next Monday" = Monday 11 May 2026 (3 days ahead), NOT the following Monday. Always confirm the exact date you calculated before booking.\n\nTIME VALIDATION — THREE RULES:\n1. DATE ONLY (no time given) → ALWAYS accept if the date is today or in the future. NEVER say "that date has already passed" for today (${humanDate}) or any future date.\n2. TODAY + specific time → only reject if that clock time is before ${currentTime} (current time). Otherwise accept.\n3. FUTURE date + any time → ALWAYS accept. NEVER say "that time has already passed" for a date after today.`;

    // Rolling memory: prepend a summary of older messages as authoritative context.
    const summaryBlock = chatSummary
      ? `CONVERSATION SUMMARY SO FAR — AUTHORITATIVE MEMORY: The messages below are only the most recent turns. Everything before them is summarised here. Treat EVERY fact in this summary as already collected — NEVER ask again for anything listed (name, age, area, duration, treatments, photos, medical answer, booking date/time), and use these exact values in booking and confirmation.\n${chatSummary}\n\n`
      : "";

    const systemPrompt = `${conversationGuard}${summaryBlock}${basePrompt}\n\n${photoInstruction}\n\n${dateParsingInstruction}${languageInstruction}${perTurnHint ? `\n\n${perTurnHint}` : ""}`;
    const openai = createOpenAI(apiKey, baseURL);

    const chatMessages = [{ role: "system", content: systemPrompt }];

    // Include recent conversation history. With a rolling summary, only the last
    // 5 turns are sent verbatim; otherwise the original 10-message window.
    if (conversationHistory && conversationHistory.length > 0) {
      const recent = conversationHistory.slice(chatSummary ? -5 : -10);
      for (const msg of recent) {
        if (msg.sender_type === "patient") {
          chatMessages.push({ role: "user", content: msg.text || "[media]" });
        } else {
          chatMessages.push({ role: "assistant", content: msg.text || "" });
        }
      }
    }

    // Build final user message — annotate any DD-MM-YYYY dates; attach images.
    // For a photo-only turn use a language-neutral marker (never English prose).
    const annotatedText = hasImages && !hasCaption
      ? "[photos attached — no caption]"
      : injectDateHint(text, now);
    if (hasImages) {
      const contentParts = [{ type: "text", text: annotatedText }];
      for (const att of imageAttachments) {
        try {
          const relPath = att.url.startsWith("/") ? att.url.slice(1) : att.url;
          const filePath = path.join(__dirname, "..", relPath);
          const imageBuffer = fs.readFileSync(filePath);
          const base64 = imageBuffer.toString("base64");
          const mimeType = att.mime_type || "image/jpeg";
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
          });
        } catch (imgErr) {
          log.warn(MODULE, "generateAIResponse:imageRead", { error: imgErr.message, url: att.url });
        }
      }
      chatMessages.push({ role: "user", content: contentParts });
    } else {
      chatMessages.push({ role: "user", content: annotatedText });
    }

    // Credential chain: resolved key first, then platform key as fallback so a
    // broken/expired tenant key doesn't force the static English fallback.
    const credCandidates = [{ apiKey, model, baseURL }];
    if (sa.apiKey && sa.apiKey !== apiKey) {
      credCandidates.push({ apiKey: sa.apiKey, model: aiSettings.openai_model || sa.model || "gpt-4o", baseURL: null });
    }

    let lastErr = null;
    for (const cred of credCandidates) {
      try {
        const client = createOpenAI(cred.apiKey, cred.baseURL);
        const completion = await client.chat.completions.create({
          model: cred.model || "gpt-4o",
          messages: chatMessages,
          max_tokens: hasImages ? 2500 : 4000,
          temperature: 0.7,
        });
        const reply = completion.choices[0]?.message?.content;
        if (reply && reply.trim()) return reply.trim();
      } catch (err) {
        lastErr = err;
        log.warn(MODULE, "generateAIResponse:keyFailed", { error: err.message });
      }
    }
    log.error(MODULE, "generateAIResponse", { error: lastErr?.message, note: "all keys failed" });
    return "Thank you for your message. A team member will follow up shortly.";
  } catch (err) {
    log.error(MODULE, "generateAIResponse", { error: err.message });
    return "Thank you for your message. A team member will follow up shortly.";
  }
};

// ─── Helper: run the high-intent lead-capture state machine ────────
// Mirrors the in-app sendMessage integration so WhatsApp / Instagram
// patients get the same slot-filling behavior. Returns true when the
// capture flow has produced a reply and the caller should skip the
// generic AI reply for this turn.
const runCaptureFlow = async ({
  conversation,
  lead,
  text,
  intent,
  setting,
  channel,
  primaryIdentifier,
  hasAttachments = false,
  sendOnChannel,
}) => {
  const capture = processHighIntentCapture({ conversation, lead, text, intent });
  if (!capture.handled) return false;

  // Persist any newly extracted lead detail.
  if (lead && capture.leadPatch) {
    await ensureLeadChannelIdentity(lead, channel, primaryIdentifier);

    let dirty = false;
    for (const key of ["name", "phone", "email"]) {
      const v = capture.leadPatch[key];
      if (v && lead[key] !== v) { lead[key] = v; dirty = true; }
    }
    if (capture.completed && lead.stage === "new") { lead.stage = "qualified"; dirty = true; }
    if (dirty) await lead.save();

    // Re-run the central automation so score/stage stay aligned after
    // capture completion or partial detail extraction.
    const beforeCaptureStage = lead.stage;
    const beforeCaptureScore = lead.score;
    const automated = await upsertInboundLeadFromMessage({
      existingLead: lead,
      tenantId: conversation.tenant_id,
      channel,
      primaryIdentifier,
      text,
      intent,
      hasAttachments,
    });
    lead = automated.lead;
    logLeadAutomationDebug("captureFlow:afterUpsert", {
      conversationId: conversation.id,
      leadId: lead?.id,
      channel,
      text,
      intent,
      hasAttachments,
      beforeStage: beforeCaptureStage,
      afterStage: lead?.stage,
      beforeScore: beforeCaptureScore,
      afterScore: lead?.score,
      captureCompleted: capture.completed,
      leadPatch: capture.leadPatch || null,
    });
  }

  conversation.lead_capture_state = capture.nextState;

  await Message.create({
    conversation_id: conversation.id,
    sender_type: "ai",
    sender_id: null,
    receiver_id: null,
    receiver_type: "patient",
    text: capture.replyText,
    metadata: {
      intent,
      auto_reply: true,
      lead_capture: true,
      phase: capture.nextState?.phase,
      missing: capture.missing,
      completed: !!capture.completed,
      escalated: !!capture.escalated,
    },
  });

  // Echo the prompt back over the live channel.
  try {
    if (typeof sendOnChannel === "function") {
      await sendOnChannel(capture.replyText);
    }
  } catch (err) {
    log.error(MODULE, "runCaptureFlow:channel", { error: err.message, conversationId: conversation.id });
  }

  // Happy path: lead just got fully captured — notify the tenant admin
  // so they know a new lead has landed in the CRM.
  if (capture.completed) {
    try {
      const tenantAdmin = await User.findByPk(conversation.tenant_id, {
        attributes: ["id", "full_name", "email", "clinic_name"],
      });
      await sendNewLeadCreatedEmail({
        toEmail: tenantAdmin?.email || setting?.notification_email,
        tenantName: tenantAdmin?.clinic_name || tenantAdmin?.full_name,
        channel,
        conversationId: conversation.id,
        collected: capture.nextState?.collected || {},
      });
    } catch (mailErr) {
      log.error(MODULE, "runCaptureFlow:newLeadEmail", { error: mailErr.message });
    }
  }

  // Escalate to tenant admin once we've exhausted prompts.
  if (capture.escalated) {
    try {
      const tenantAdmin = await User.findByPk(conversation.tenant_id, {
        attributes: ["id", "full_name", "email", "clinic_name"],
      });
      const recent = await Message.findAll({
        where: { conversation_id: conversation.id },
        order: [["created_at", "DESC"]],
        limit: 8,
        attributes: ["sender_type", "text"],
      });
      await sendLeadCaptureEscalation({
        toEmail: tenantAdmin?.email || setting?.notification_email,
        tenantName: tenantAdmin?.clinic_name || tenantAdmin?.full_name,
        leadName: lead?.name,
        channel,
        conversationId: conversation.id,
        collected: capture.nextState?.collected || {},
        missing: capture.missing || [],
        recentMessages: recent.map((m) => ({ sender: m.sender_type, text: m.text })).reverse(),
      });
    } catch (mailErr) {
      log.error(MODULE, "runCaptureFlow:escalation", { error: mailErr.message });
    }
  }

  return true;
};

// ─── Helper: find or create conversation for a lead ─────────────────
const getOrCreateConversation = async (lead, channel, tenantId) => {
  let conversation = await Conversation.findOne({
    where: { lead_id: lead.id, tenant_id: tenantId, channel, is_deleted: false },
  });

  if (!conversation) {
    conversation = await Conversation.create({
      lead_id: lead.id,
      tenant_id: tenantId,
      channel,
      status: "open",
      intent: "unknown",
      ai_enabled: true,
      unread_count: 1,
      last_message_at: new Date(),
    });
    log.info(MODULE, "getOrCreateConversation", { created: true, leadId: lead.id, channel });
  }

  return conversation;
};

// ─────────────────────────────────────────────────────────────────────────
// ⚠️ WhatsApp Meta webhook handlers remain removed (WhatsApp uses the
// self-hosted Baileys/QR transport instead — see whatsappQrBootstrap.js).
// The Instagram webhook handlers below ARE Meta's Graph API handshake/
// receive endpoints, but CORRECTED (2026-07-31) to a per-tenant model: each
// clinic brings their OWN Meta App, so the URL path (:tenantId/:slot)
// identifies WHICH tenant's row to use — there is no shared/global Meta App
// or global verify token/app secret anymore (see
// .ai/sessions/2026-07-31-instagram-dm-meta-migration.md).
// ─────────────────────────────────────────────────────────────────────────

const notImplemented = (channel, kind) => async (_req, res) => {
  log.warn(MODULE, `${channel}:${kind}`, { message: "Meta webhook removed — awaiting new connection flow." });
  return res.status(501).json({
    success: false,
    code: "CHANNEL_NOT_IMPLEMENTED",
    message: `${channel} ${kind} is not implemented — the Meta integration was removed and a new connection flow is pending.`,
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Instagram — per-tenant Meta Graph API webhook (verification handshake +
// inbound receive). Tenant is resolved from the URL path, not a hardcoded/
// single-tenant assumption.
// ─────────────────────────────────────────────────────────────────────────

/** Resolve the (tenant_id, slot) InstagramSession row identified by the
 *  incoming webhook request's URL path (/api/webhooks/instagram/:tenantId/:slot). */
const resolveTenantSessionFromPath = async (req) => {
  const tenantId = parseInt(req.params.tenantId, 10);
  const slot = parseInt(req.params.slot, 10) || 1;
  if (!Number.isFinite(tenantId)) return null;
  return InstagramSession.findOne({ where: { tenant_id: tenantId, slot } });
};

/** GET /api/webhooks/instagram/:tenantId/:slot — Meta's webhook verification
 *  handshake. Verified against THAT tenant's own generated verify token
 *  (each clinic pastes their own verify token into their own Meta App). */
const instagramVerify = async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const session = await resolveTenantSessionFromPath(req);
  if (!session || !session.webhook_verify_token) {
    log.warn(MODULE, "instagram:verify", { message: "No tenant session/verify token for this path.", params: req.params });
    return res.sendStatus(403);
  }

  if (mode === "subscribe" && token === session.webhook_verify_token) {
    log.info(MODULE, "instagram:verify", { message: "Webhook verified.", tenantId: session.tenant_id, slot: session.slot });
    return res.status(200).send(challenge);
  }
  log.warn(MODULE, "instagram:verify", { message: "Verification failed — token mismatch.", tenantId: session.tenant_id });
  return res.sendStatus(403);
};

/** Constant-time compare of the X-Hub-Signature-256 header against a
 *  computed HMAC, using THAT tenant's own Meta App Secret (each clinic has
 *  a different one — there is no shared/global app secret to fall back to). */
const verifyMetaSignature = (req, appSecret) => {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !appSecret) return false;
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/** Dedupe + normalize + run the SAME channel-agnostic AI/lead pipeline every
 *  other channel uses, for one inbound Instagram message. `session` is the
 *  already-resolved tenant's InstagramSession row (resolved by the caller
 *  from the request's URL path). */
const handleInstagramInboundMessage = async ({ session, senderId, message }) => {
  const tenantId = session.tenant_id;

  const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
  if (!setting || setting.instagram_enabled === false) return;

  // Dedupe — the same message id is never processed twice.
  const messageId = message.mid;
  if (messageId) {
    const dup = await Message.findOne({
      where: { metadata: { [Op.contains]: { instagram_message_id: messageId } } },
    });
    if (dup) return;
  }

  let text = message.text || "";
  const attachments = [];
  if (Array.isArray(message.attachments)) {
    for (const attachment of message.attachments) {
      const att = await ingestInstagramAttachment({ tenantId, attachment, accessToken: session.access_token });
      if (att) attachments.push(att);
    }
  }
  if (!text && attachments.length === 0) return;

  const placeholderText = attachments.some((a) => a.kind === "image") ? "[image]" : "[attachment]";

  const detectedIntent = analyzeIntent(text, setting);

  const { lead } = await upsertInboundLeadFromMessage({
    tenantId,
    channel: "Instagram",
    primaryIdentifier: senderId,
    fallbackName: null,
    text: text || placeholderText,
    intent: detectedIntent,
    hasAttachments: attachments.length > 0,
  });

  const conversation = await getOrCreateConversation(lead, "Instagram", tenantId);

  await Message.create({
    conversation_id: conversation.id,
    sender_type: "patient",
    sender_id: null,
    receiver_id: null,
    receiver_type: "user",
    text: text || placeholderText,
    attachments,
    metadata: { instagram_message_id: messageId, from: senderId, source: "ig-webhook" },
  });

  conversation.unread_count += 1;
  conversation.last_message_at = new Date();
  conversation.last_patient_message_at = new Date();
  // Remember the exact IGSID this message arrived from so replies (AI, manual,
  // follow-ups) go back to the SAME Instagram thread.
  if (senderId && conversation.channel_thread_id !== senderId) {
    conversation.channel_thread_id = senderId;
  }

  const intent = getPinnedIntent(conversation.intent, detectedIntent);
  conversation.intent = intent;

  const aiRespondsTo = setting.ai_responds_to_intents || ["low", "medium", "high"];
  const emailNotifyFor = setting.email_notify_intents || ["high"];

  if (conversation.ai_enabled && aiRespondsTo.includes(intent)) {
    try {
      const allHistory = await Message.findAll({
        where: { conversation_id: conversation.id },
        order: [["created_at", "ASC"]],
        attributes: ["sender_type", "text", "metadata"],
      });
      const history = allHistory.slice(0, -1); // exclude the just-saved patient turn
      const imageAttachments = attachments.filter((a) => a.kind === "image" && a.url);
      const aiInputText = text || (imageAttachments.length > 0 ? "" : text);

      const faqMatch = await matchFAQ(aiInputText, tenantId);
      const faqAnswer = faqMatch?.answer || null;
      const promptOverride = setting.prompt_instructions || null;

      let aiText = faqMatch
        ? faqAnswer || ""
        : await generateAIResponse(aiInputText, intent, setting, history, imageAttachments, promptOverride);

      await Message.create({
        conversation_id: conversation.id,
        sender_type: "ai",
        sender_id: null,
        receiver_id: null,
        receiver_type: "patient",
        text: aiText,
        metadata: { intent, auto_reply: true, faq_matched: !!faqMatch, source: "ig-webhook" },
      });

      if (lead) {
        const refreshedLead = await Lead.findByPk(lead.id);
        await maybeMarkLeadWonFromConfirmation({ lead: refreshedLead, conversation, text: aiText });
      }

      try {
        if (aiText) {
          await sendOutbound("Instagram", setting, senderId, aiText, { conversation });
        }
      } catch (sendErr) {
        log.error(MODULE, "instagram:receive:sendFailed", { tenantId, senderId, error: sendErr.message });
      }

      if (intent === "low" && setting.escalate_low_confidence) conversation.status = "pending";
    } catch (aiErr) {
      log.error(MODULE, "instagram:receive:ai", { error: aiErr.message });
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
      log.error(MODULE, "instagram:receive:email", { error: mailErr.message });
    }
  }

  if (lead) await enforceLeadScoreStageConsistency(lead);
  await conversation.save();
};

/** POST /api/webhooks/instagram/:tenantId/:slot — Meta's inbound message
 *  delivery. The URL path identifies which tenant's row to use — signature
 *  verification uses THAT tenant's own Meta App Secret, since each clinic
 *  brings their own Meta App and there is no shared/global app secret. */
const instagramReceive = async (req, res) => {
  const session = await resolveTenantSessionFromPath(req);
  if (!session || !session.meta_app_secret) {
    log.warn(MODULE, "instagram:receive", { message: "No tenant session/app secret for this path.", params: req.params });
    return res.sendStatus(403);
  }

  // Respond 200 immediately after signature verification passes, per Meta's
  // requirement (Meta expects a fast ack and will retry/back off otherwise).
  if (!verifyMetaSignature(req, session.meta_app_secret)) {
    log.warn(MODULE, "instagram:receive", { message: "Signature verification failed.", tenantId: session.tenant_id });
    return res.sendStatus(403);
  }

  const body = req.rawBody ? JSON.parse(req.rawBody.toString("utf8")) : req.body;
  res.sendStatus(200);

  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      const messaging = entry.messaging || [];
      for (const event of messaging) {
        if (!event.message || event.message.is_echo) continue; // ignore echoes of our own sends
        const senderId = event.sender?.id;
        if (!senderId) continue;
        await handleInstagramInboundMessage({ session, senderId, message: event.message });
      }
    }
  } catch (err) {
    log.error(MODULE, "instagram:receive", { error: err.message, tenantId: session.tenant_id });
  }
};

// Reusable pipeline helpers — consumed by the WhatsApp-QR bootstrap
// (whatsappQrBootstrap.js), the Instagram webhook receive handler above, and
// the in-app conversation controller. These are channel-agnostic.
exports.generateAIResponse = generateAIResponse;
exports.analyzeIntent = analyzeIntent;
exports.matchFAQ = matchFAQ;
exports.getOrCreateConversation = getOrCreateConversation;
exports.maybeMarkLeadWonFromConfirmation = maybeMarkLeadWonFromConfirmation;
exports.scheduleBatchedPhotoReply = scheduleBatchedPhotoReply;

exports.whatsappVerify   = notImplemented("WhatsApp", "verify");
exports.whatsappReceive  = notImplemented("WhatsApp", "receive");
exports.instagramVerify  = instagramVerify;
exports.instagramReceive = instagramReceive;
