const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { createOpenAI } = require("../utils/openaiClient");
const sequelize = require("../config/database");
const { Conversation, Message, Lead, User, AISetting, FAQ } = require("../models");
const log = require("../utils/logger");
const { sendOutbound } = require("../services/channelService");
const { sendIntentNotification, sendLeadCaptureEscalation, sendNewLeadCreatedEmail } = require("../services/emailService");
const { processHighIntentCapture } = require("../services/leadCapture");
const {
  enforceLeadScoreStageConsistency,
  ensureLeadChannelIdentity,
  getPinnedIntent,
  resolveChannelRecipientId,
  upsertInboundLeadFromMessage,
} = require("../services/leadAutomation");
const { classifyLeadIntent } = require("../services/leadIntentService");
const { triggerLeadSummary } = require("../services/leadSummaryService");
const { getPlatformPromptInstructions, getPlatformUseCases, buildUseCasesBlock } = require("../utils/platformAISettings");
const { rephraseFAQAnswer } = require("../services/aiPhrasing");
const appointmentAvailabilityService = require("../services/appointmentAvailabilityService");

const MODULE = "ConversationController";

// Returns true if the requesting user is allowed to access the given conversation.
function canAccessConversation(user, conversation) {
  const role = user.Role?.name;
  if (role === "super_admin") return true;
  const tenantId = user.tenant_id || user.id;
  if (role === "tenant_admin") return conversation.tenant_id === tenantId;
  // staff_user — only their assigned conversations
  return conversation.assigned_to === user.id;
}

const logLeadAutomationDebug = (_label, _details) => {};

// ─── Load tenant AI settings (or use defaults) ─────────────────────
const getAISettings = async (tenantId) => {
  let setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
  if (!setting) {
    setting = await AISetting.create({ tenant_id: tenantId });
  }
  return setting;
};

// ─── AI Intent Analysis (uses tenant keywords, falls back to signal patterns) ─────────────────────
const INTENT_SIGNAL_HIGH = /\b(book|booking|booked|schedule|scheduled|appointment|appointments|slot|visit|come in|consultation|consult|reserve|reserved|confirm|confirmed|asap|urgent|today|tomorrow|right away|immediately|soon)\b/i;
const INTENT_SIGNAL_MEDIUM = /\b(price|pricing|cost|charge|fee|package|quotation|quote|how much|details|detail|information|info|procedure|process|treatment|plan|options|available)\b/i;
// Detects a booking confirmation in ANY language without relying on fixed keywords.
//
// The bot's FINAL confirmation always wraps the booked slot in single quotes:
//   '15 May at 10 AM'   '15 May 2026 at 3pm'   '5 January at 15:00'
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

// ─── OpenAI tool-calling: booking tools (first tool-call infra in this
// codebase — see generateAIResponse's intercept loop below) ─────────────
// Tool schemas passed to OpenAI. BOOKING_TOOLS and TOOL_HANDLERS share the
// same key set — a future tool is added by appending to both, never by
// growing a branching chain in the intercept loop itself.
const BOOKING_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check open appointment slots at the clinic within a date range.",
      parameters: {
        type: "object",
        properties: {
          range_start: { type: "string", description: "ISO date (YYYY-MM-DD), inclusive." },
          range_end: { type: "string", description: "ISO date (YYYY-MM-DD), inclusive." },
        },
        required: ["range_start", "range_end"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book a confirmed appointment slot after the patient has picked an exact date/time.",
      parameters: {
        type: "object",
        properties: {
          start: { type: "string", description: "ISO 8601 datetime for the appointment start." },
          end: { type: "string", description: "ISO 8601 datetime for the appointment end." },
          notes: { type: "string", description: "Short summary of what the appointment is for." },
        },
        required: ["start", "end"],
      },
    },
  },
];

// Generic dispatch table — { [toolName]: async (args, ctx) => result }.
// `ctx` is the toolContext passed into generateAIResponse: { tenantId,
// leadId, conversationId }.
const TOOL_HANDLERS = {
  check_availability: async (args, ctx) => appointmentAvailabilityService.getAvailability({
    tenantId: ctx.tenantId, rangeStart: args.range_start, rangeEnd: args.range_end,
  }),
  book_appointment: async (args, ctx) => appointmentAvailabilityService.bookSlot({
    tenantId: ctx.tenantId, leadId: ctx.leadId, conversationId: ctx.conversationId,
    start: args.start, end: args.end, title: "Clinic appointment", description: args.notes,
  }),
};

// Runaway guard for the tool-call intercept loop inside generateAIResponse.
const MAX_TOOL_CALL_ITERATIONS = 3;

// Exported so webhookController.js's independent generateAIResponse
// (WhatsApp/Instagram, see issue #41) can reuse the SAME tool schemas/
// dispatch table instead of forking a second definition. Purely additive —
// does not change any behavior here.
exports.BOOKING_TOOLS = BOOKING_TOOLS;
exports.TOOL_HANDLERS = TOOL_HANDLERS;
exports.MAX_TOOL_CALL_ITERATIONS = MAX_TOOL_CALL_ITERATIONS;

const maybeMarkLeadWonFromOutgoingConfirmation = async ({ lead, conversation, text }) => {
  if (!lead || !text) return lead;
  // Lead is already won — skip AI call and don't re-trigger summary on every message.
  if (lead.stage === "won") return lead;

  const regexMatch = isBookingConfirmationMessage(text);
  const classification = await classifyLeadIntent({
    tenantId: lead.created_by || lead.assigned_to,
    text,
    currentStage: lead.stage || "new",
    currentScore: lead.score || 0,
    fallbackIntent: conversation?.intent || "low",
  });

  // Use only hasExplicitWonIntent — the booking IS confirmed/done.
  // recommended.stage === "won" and hasBookingIntent+hasPositiveIntent are too
  // broad: they also fire when the AI is asking for a date/time (discussion),
  // which must stay in discussion until the booking is actually confirmed.
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

const analyzeIntent = (text, aiSettings) => {
  const lower = (text || "").toLowerCase();

  const highKeywords = aiSettings.high_intent_keywords || [];
  const mediumKeywords = aiSettings.medium_intent_keywords || [];

  if (highKeywords.some((s) => lower.includes(s.toLowerCase()))) return "high";
  if (mediumKeywords.some((s) => lower.includes(s.toLowerCase()))) return "medium";

  // Signal-based fallback: works even when no keywords are configured
  if (INTENT_SIGNAL_HIGH.test(lower)) return "high";
  if (INTENT_SIGNAL_MEDIUM.test(lower)) return "medium";

  return "low";
};

// ─── Build system prompt from tenant settings ───────────────────────
// Prompt body defaults to PlatformAISetting (super admin) but a tenant
// can override it via AISetting.prompt_instructions (see aiSettingController
// and the AI Chat settings page). Pass platformPrompt in from caller
// (already resolved by generateAIResponse's prompt-precedence logic).
const buildSystemPrompt = (aiSettings, intent, platformPrompt = "") => {
  const customPrompt = platformPrompt || "";

  // If a custom conversion prompt is configured, use it as the sole authority.
  // Do NOT append generic intent-based instructions — they contradict custom sales flows.
  if (customPrompt.trim()) {
    return customPrompt.trim();
  }

  // Fallback when no custom prompt is set
  const toneMap = {
    professional: "Respond in a professional, clear, and confident tone.",
    warm: "Respond in a warm, caring, and empathetic tone.",
    premium: "Respond in a premium, sophisticated, and exclusive tone.",
    friendly: "Respond in a friendly, casual, and approachable tone.",
    formal: "Respond in a formal, respectful, and structured tone.",
  };
  const toneInstruction = toneMap[aiSettings.ai_tone] || toneMap.professional;

  return `You are an AI assistant for a medical clinic. ${toneInstruction}
Keep responses concise (2-3 sentences). Do not use markdown formatting. Be helpful and natural.`;
};

// ─── Match patient message against tenant FAQs ──────────────────────
const matchFAQ = async (text, tenantId) => {
  const faqs = await FAQ.findAll({
    where: { tenant_id: tenantId, is_active: true, is_deleted: false },
  });
  if (!faqs.length) return null;

  const lower = text.toLowerCase();
  for (const faq of faqs) {
    const keywords = faq.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matchCount = keywords.filter((kw) => lower.includes(kw)).length;
    // Match if more than half the significant words appear in the message
    if (keywords.length > 0 && matchCount / keywords.length >= 0.5) {
      return faq.answer;
    }
  }
  return null;
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
    if (/\bmorning\b/i.test(text))              addTimeHint("morning",        9 * 60);
    if (/\bafternoon\b/i.test(text))             addTimeHint("afternoon",     13 * 60);
    if (/\b(?:evening|tonight)\b/i.test(text))   addTimeHint("evening/tonight", 18 * 60);
    if (/\bany\s*time\b/i.test(text))
      hints.push(`"anytime" — FLEXIBLE TIME, VALID for booking on any accepted date`);
  }

  if (!hints.length) return text;
  return `${text}\n\n[PARSED DATE/TIME: ${hints.join(" | ")}]`;
};

// ─── Generate AI Response via OpenAI ────────────────────────────────
// `toolContext` ({ tenantId, leadId, conversationId }) is opt-in and
// additive — when null/omitted, the request sent to OpenAI is byte-for-byte
// identical to pre-#40 behavior (no `tools` key at all). Only sendMessage's
// patient branch passes it today; any other caller can omit it and simply
// won't be offered booking tools.
const generateAIResponse = async (patientText, intent, aiSettings, conversationHistory, imageAttachments = [], toolContext = null) => {
  if (!aiSettings.openai_api_key) {
    log.warn(MODULE, "generateAIResponse", { message: "No OpenAI API key configured, using fallback." });
    if (intent === "high") return "Thank you for your interest! I'd love to help you move forward. Could you share your preferred dates and any specific requirements?";
    if (intent === "medium") return "Great question! We offer several treatment options. Would you like me to explain the details or schedule a free consultation?";
    return "Thank you for reaching out! We're here to help whenever you're ready. Feel free to ask any questions.";
  }

  try {
    const model = aiSettings.openai_model || "gpt-4o-mini";
    const keyPreview = aiSettings.openai_api_key.slice(0, 7) + "..." + aiSettings.openai_api_key.slice(-4);
    log.info(MODULE, "generateAIResponse", { model, keyPreview, intent, tone: aiSettings.ai_tone });

    const openai = createOpenAI(aiSettings.openai_api_key, aiSettings.openai_base_url);

    // Prompt precedence: the account's own personal prompt (prompt_instructions)
    // overrides the platform default when it's non-empty; otherwise fall back to
    // the platform prompt. This lets the super-admin (or any account) run a
    // different prompt than the platform default.
    const personalPrompt = (aiSettings.prompt_instructions || "").trim();
    const platformPrompt = personalPrompt || (await getPlatformPromptInstructions());
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
    const resolvedPrompt = platformPrompt
      .replace(/\{\{CURRENT_DATE\}\}/g, currentDate)
      .replace(/\{\{CURRENT_TIME\}\}/g, currentTime);

    const hasImages = imageAttachments.length > 0;
    const historyLength = conversationHistory ? conversationHistory.length : 0;
    const conversationGuard = historyLength > 0
      ? `CRITICAL RULE: This is an ONGOING conversation with ${historyLength} prior messages. You MUST NOT send the Step 1 opening greeting again. Read the conversation history below and continue from where it left off.\n\n`
      : "";
    const photoInstruction = hasImages
      ? `PHOTO ANALYSIS: The patient has sent hair photos which are attached to this message. You CAN see these images. Carefully examine each photo and assess the actual stage of hair loss visible. Look for: hairline recession, crown thinning, temple loss, and overall hair density. Base your Step 6 graft estimate ONLY on what you actually observe in the photos combined with what the patient told you (area, duration, treatments). Do NOT give a generic or random estimate — give one based on what you see.`
      : `PHOTO HANDLING: No images have been provided. If the patient mentions sending photos but no images are attached, ask them to resend. If you see "[image]" in history without actual images now, base your Step 6 assessment solely on what the patient described (area affected, duration, treatments tried).`;

    const dateParsingInstruction = `DATE & DAY PARSING — CRITICAL: Today is ${currentDate} which is ${humanDate} (${todayDayName}). Current time is ${currentTime}. Users commonly write dates as DD-MM-YYYY (e.g. "12-5-2026" = 12 May 2026) or DD/MM/YYYY. ALWAYS interpret user-provided dates as DD-MM-YYYY format. Compare actual calendar dates — NOT strings. A date is VALID if it falls on or after ${humanDate} — this explicitly includes TODAY (${humanDate}).\n\nRELATIVE DATE CALCULATION: When the user says a relative day (e.g. "next Monday", "next week Monday", "tomorrow"), calculate the exact calendar date based on today being ${todayDayName} ${humanDate}. Example: if today is Friday 8 May 2026, "next Monday" = Monday 11 May 2026 (3 days ahead), NOT the following Monday. Always confirm the exact date you calculated before booking.\n\nTIME VALIDATION — THREE RULES:\n1. DATE ONLY (no time given) → ALWAYS accept if the date is today or in the future. NEVER say "that date has already passed" for today (${humanDate}) or any future date.\n2. TODAY + specific time → only reject if that clock time is before ${currentTime} (current time). Otherwise accept.\n3. FUTURE date + any time → ALWAYS accept. NEVER say "that time has already passed" for a date after today.`;

    const baseSystemPrompt = buildSystemPrompt(aiSettings, intent, resolvedPrompt + useCasesBlock);
    // Only added when toolContext is present — keeps the request byte-for-byte
    // identical to pre-#40 behavior for any caller that omits toolContext.
    const bookingToolsInstruction = toolContext
      ? `\n\nBOOKING TOOLS: You have access to check_availability and book_appointment. When a patient asks to book an appointment, call check_availability first and offer 2-4 concrete slots from the result. If the tool result has "connected": false, do NOT offer any slots — tell the patient to contact the clinic directly to book, and do not call book_appointment. Only call book_appointment after the patient has explicitly confirmed one specific date and time from the offered slots. If book_appointment returns "booked": false, apologize that the slot is no longer available, call check_availability again, and offer new options.`
      : "";
    const systemPrompt = `${conversationGuard}${baseSystemPrompt}\n\n${photoInstruction}\n\n${dateParsingInstruction}${bookingToolsInstruction}`;

    const chatMessages = [{ role: "system", content: systemPrompt }];

    if (conversationHistory && conversationHistory.length > 0) {
      const recent = conversationHistory.slice(-10);
      for (const msg of recent) {
        if (msg.sender_type === "patient") {
          chatMessages.push({ role: "user", content: msg.text || "[media]" });
        } else {
          chatMessages.push({ role: "assistant", content: msg.text || "" });
        }
      }
    }

    // Build final user message — annotate any DD-MM-YYYY dates so the AI
    // never has to guess the format; then attach images as vision content.
    const annotatedText = injectDateHint(patientText, now);
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

    const requestOpts = {
      model,
      messages: chatMessages,
      max_tokens: hasImages ? 500 : 300,
      temperature: 0.7,
    };
    // Tools are only offered when toolContext is present — omitted entirely
    // otherwise, so the request shape is unchanged for non-booking callers.
    if (toolContext) {
      requestOpts.tools = BOOKING_TOOLS;
      requestOpts.tool_choice = "auto";
    }

    let completion = await openai.chat.completions.create(requestOpts);

    // Tool-call intercept loop (only reachable when toolContext was present,
    // since that's the only way `tools` was offered to the model). Capped at
    // MAX_TOOL_CALL_ITERATIONS as a runaway guard.
    let iterations = 0;
    while (
      toolContext &&
      completion.choices[0]?.message?.tool_calls?.length &&
      iterations < MAX_TOOL_CALL_ITERATIONS
    ) {
      iterations += 1;
      const assistantMessage = completion.choices[0].message;
      chatMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const handler = TOOL_HANDLERS[toolCall.function.name];
        let resultPayload;
        try {
          const args = JSON.parse(toolCall.function.arguments || "{}");
          if (!handler) throw new Error(`Unknown tool: ${toolCall.function.name}`);
          resultPayload = await handler(args, toolContext);
        } catch (toolErr) {
          log.error(MODULE, "generateAIResponse:toolCall", {
            tool: toolCall.function.name,
            error: toolErr.message,
          });
          resultPayload = { error: true, message: toolErr.message };
        }
        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(resultPayload),
        });
      }

      completion = await openai.chat.completions.create({ ...requestOpts, messages: chatMessages });
    }

    const reply = completion.choices[0]?.message?.content;
    if (reply) return reply.trim();

    log.warn(MODULE, "generateAIResponse", { message: "Empty OpenAI response" });
    return "Thank you for your message. Let me connect you with our team for further assistance.";
  } catch (err) {
    log.error(MODULE, "generateAIResponse", {
      error: err.message,
      status: err.status,
      code: err.code,
      type: err.type,
    });
    return "Thank you for your message. I'm having a brief issue — a team member will follow up shortly.";
  }
};

// ─── Get all conversations ──────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantId = req.user.tenant_id || req.user.id;

    const where = { is_deleted: false };

    if (role === "super_admin") {
      // sees all
    } else if (role === "tenant_admin") {
      where.tenant_id = tenantId;
    } else {
      // staff_user sees only assigned conversations
      where.assigned_to = req.user.id;
    }

    const leadInclude = {
      model: Lead,
      attributes: ["id", "name", "phone", "email", "source", "stage", "score"],
    };

    if (role === "tenant_admin") {
      leadInclude.where = { created_by: req.user.id };
      leadInclude.required = true;
    }

    const conversations = await Conversation.findAll({
      where,
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT text FROM messages
              WHERE messages.conversation_id = "Conversation"."id"
              ORDER BY messages.created_at DESC
              LIMIT 1
            )`),
            "last_message_text",
          ],
        ],
      },
      include: [
        leadInclude,
        {
          model: User,
          as: "AssignedUser",
          attributes: ["id", "full_name", "email"],
        },
      ],
      order: [["last_message_at", "DESC"]],
    });

    // Map to frontend-friendly format
    const data = conversations.map((c) => ({
      id: String(c.id),
      leadId: String(c.lead_id),
      leadName: c.Lead?.name || "Unknown",
      leadPhone: c.Lead?.phone || null,
      leadEmail: c.Lead?.email || null,
      leadScore: c.Lead?.score ?? null,
      lastMessage: c.dataValues.last_message_text || null,
      channel: c.channel,
      status: c.status,
      intent: c.intent,
      aiEnabled: c.ai_enabled,
      unreadCount: c.unread_count,
      assignedTo: c.AssignedUser?.full_name || "Unassigned",
      assignedToId: c.assigned_to,
      lastMessageAt: c.last_message_at,
      createdAt: c.createdAt,
      tenantId: c.tenant_id,
    }));

    log.info(MODULE, "getAll", { userId: req.user.id, resultCount: data.length });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get messages for a conversation ────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, is_deleted: false },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    if (!canAccessConversation(req.user, conversation)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const messages = await Message.findAll({
      where: { conversation_id: req.params.id },
      include: [
        { model: User, as: "SenderUser", attributes: ["id", "full_name"] },
      ],
      order: [["created_at", "ASC"]],
    });

    const data = messages.map((m) => ({
      id: String(m.id),
      conversationId: String(m.conversation_id),
      sender: m.sender_type,
      senderName: m.sender_type === "patient"
        ? "Patient"
        : m.sender_type === "ai"
        ? "AI Assistant"
        : m.SenderUser?.full_name || "Staff",
      senderId: m.sender_id,
      text: m.text,
      attachments: m.attachments || [],
      metadata: m.metadata,
      timestamp: m.createdAt,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getMessages", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Create conversation (from a lead) ──────────────────────────────
exports.create = async (req, res) => {
  try {
    const { lead_id, channel, assigned_to } = req.body;
    const tenantId = req.user.tenant_id || req.user.id;

    if (!lead_id) {
      return res.status(400).json({ success: false, message: "lead_id is required." });
    }

    const lead = await Lead.findOne({ where: { id: lead_id, is_deleted: false } });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    // Check if conversation already exists for this lead
    const existing = await Conversation.findOne({
      where: { lead_id, tenant_id: tenantId, is_deleted: false },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Conversation already exists for this lead.",
        data: { id: existing.id },
      });
    }

    const conversation = await Conversation.create({
      lead_id,
      tenant_id: tenantId,
      assigned_to: assigned_to || req.user.id,
      channel: channel || "Web Chat",
      status: "open",
      intent: "unknown",
      ai_enabled: true,
      unread_count: 0,
      last_message_at: new Date(),
    });

    log.info(MODULE, "create", { userId: req.user.id, conversationId: conversation.id, leadId: lead_id });
    return res.status(201).json({ success: true, message: "Conversation created.", data: { id: conversation.id } });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Send message (patient or human staff) ──────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { text, sender_type } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "text is required." });
    }

    const conversation = await Conversation.findOne({
      where: { id: conversationId, is_deleted: false },
      include: [{ model: Lead, attributes: ["id", "name"] }],
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    if (!canAccessConversation(req.user, conversation)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const tenantId = conversation.tenant_id;
    const aiSettings = await getAISettings(tenantId);

    log.info(MODULE, "sendMessage:config", {
      conversationId,
      tenantId,
      ai_enabled: conversation.ai_enabled,
      has_api_key: !!aiSettings.openai_api_key,
      model: aiSettings.openai_model,
      sender_type: sender_type || "human",
    });

    const type = sender_type || "human";
    const messages = [];

    if (type === "patient") {
      // ── Patient sends a message ──────────────────────────────
      const patientMsg = await Message.create({
        conversation_id: conversationId,
        sender_type: "patient",
        sender_id: null,
        receiver_id: conversation.assigned_to,
        receiver_type: "user",
        text: text.trim(),
        metadata: {},
      });
      messages.push(patientMsg);

      // Analyze intent using tenant keywords + English fallback regex.
      // This is a fast, synchronous estimate — it gets replaced below with the
      // multilingual AI classification result once that finishes.
      const detectedIntent = analyzeIntent(text, aiSettings);
      let intent = getPinnedIntent(conversation.intent, detectedIntent);
      conversation.intent = intent;
      conversation.unread_count += 1;
      conversation.last_message_at = new Date();
      conversation.last_patient_message_at = new Date();

      // Determine which intents the AI should respond to (default: low + medium)
      const aiRespondsTo = aiSettings.ai_responds_to_intents || ["low", "medium"];
      const emailNotifyFor = aiSettings.email_notify_intents || ["high"];

      // Fetch recent messages so the AI can interpret short context-dependent
      // replies (e.g. "yes", "ok", "ہاں") in the context of the conversation.
      const recentHistory = await Message.findAll({
        where: { conversation_id: conversationId },
        order: [["created_at", "DESC"]],
        limit: 6,
        attributes: ["sender_type", "text"],
      });
      // Reverse to chronological order and exclude the just-saved patient message
      const conversationHistory = recentHistory
        .reverse()
        .slice(0, -1)
        .map((m) => ({ role: m.sender_type === "patient" ? "patient" : "clinic", text: m.text || "" }));

      let lead = await Lead.findByPk(conversation.lead_id);
      if (lead) {
        const primaryIdentifier = resolveChannelRecipientId(lead, conversation.channel);
        const beforeStage = lead.stage;
        const beforeScore = lead.score;
        const automated = await upsertInboundLeadFromMessage({
          existingLead: lead,
          tenantId,
          channel: conversation.channel,
          primaryIdentifier,
          text: text.trim(),
          intent,
          currentIntent: conversation.intent,
          hasAttachments: false,
          conversationHistory,
        });
        lead = automated.lead;
        logLeadAutomationDebug("patientMessage:afterUpsert", {
          conversationId,
          leadId: lead?.id,
          senderType: "patient",
          channel: conversation.channel,
          text: text.trim(),
          intent,
          beforeStage,
          afterStage: lead?.stage,
          beforeScore,
          afterScore: lead?.score,
        });
      }

      // ── High-intent lead capture state machine ─────────────────────
      // When the patient says something high-intent we run a slot-filling
      // dialogue to collect name / phone / email before letting the
      // generic AI reply take over. After 2 prompts without enough info
      // we escalate to the tenant admin via email.
      let captureHandled = false;
      if (conversation.ai_enabled) {
        const capture = processHighIntentCapture({ conversation, lead, text, intent });

        if (capture.handled) {
          captureHandled = true;

          // Persist any lead detail extracted from the patient reply.
          if (lead && capture.leadPatch) {
            await ensureLeadChannelIdentity(lead, conversation.channel, resolveChannelRecipientId(lead, conversation.channel));

            let leadDirty = false;
            for (const key of ["name", "phone", "email"]) {
              const val = capture.leadPatch[key];
              if (val && lead[key] !== val) {
                lead[key] = val;
                leadDirty = true;
              }
            }
            if (capture.completed && lead.stage === "new") {
              lead.stage = "qualified";
              leadDirty = true;
            }
            if (leadDirty) await lead.save();

            const beforeCaptureStage = lead.stage;
            const beforeCaptureScore = lead.score;
            const automated = await upsertInboundLeadFromMessage({
              existingLead: lead,
              tenantId,
              channel: conversation.channel,
              primaryIdentifier: resolveChannelRecipientId(lead, conversation.channel),
              text: text.trim(),
              intent,
              currentIntent: conversation.intent,
              hasAttachments: false,
              conversationHistory,
            });
            lead = automated.lead;
            logLeadAutomationDebug("patientMessage:captureAfterUpsert", {
              conversationId,
              leadId: lead?.id,
              senderType: "patient",
              channel: conversation.channel,
              text: text.trim(),
              intent,
              beforeStage: beforeCaptureStage,
              afterStage: lead?.stage,
              beforeScore: beforeCaptureScore,
              afterScore: lead?.score,
              captureCompleted: capture.completed,
              leadPatch: capture.leadPatch || null,
            });
          }

          conversation.lead_capture_state = capture.nextState;

          const captureMsg = await Message.create({
            conversation_id: conversationId,
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
          messages.push(captureMsg);

          // Dispatch the prompt back over the original channel.
          try {
            const setting = aiSettings;
            const recipientId = resolveChannelRecipientId(lead, conversation.channel);
            if (recipientId && (conversation.channel === "WhatsApp" || conversation.channel === "Instagram")) {
              await sendOutbound(conversation.channel, setting, recipientId, capture.replyText, { conversation });
            }
          } catch (channelErr) {
            log.error(MODULE, "sendMessage:captureChannelDispatch", {
              error: channelErr.message,
              conversationId,
            });
          }

          // Happy path: lead just got fully captured — notify the
          // tenant admin that a new lead has landed.
          if (capture.completed) {
            try {
              const tenantAdmin = await User.findByPk(conversation.tenant_id, {
                attributes: ["id", "full_name", "email", "clinic_name"],
              });
              const toEmail = tenantAdmin?.email || aiSettings.notification_email;
              await sendNewLeadCreatedEmail({
                toEmail,
                tenantName: tenantAdmin?.clinic_name || tenantAdmin?.full_name,
                channel: conversation.channel,
                conversationId,
                collected: capture.nextState?.collected || {},
              });
            } catch (mailErr) {
              log.error(MODULE, "sendMessage:newLeadEmail", {
                error: mailErr.message,
                conversationId,
              });
            }
          }

          // If we ran out of attempts, email the tenant admin so they
          // can complete the lead manually.
          if (capture.escalated) {
            try {
              const tenantAdmin = await User.findByPk(conversation.tenant_id, {
                attributes: ["id", "full_name", "email", "clinic_name"],
              });
              const toEmail = tenantAdmin?.email || aiSettings.notification_email;
              const recent = await Message.findAll({
                where: { conversation_id: conversationId },
                order: [["created_at", "DESC"]],
                limit: 8,
                attributes: ["sender_type", "text"],
              });
              await sendLeadCaptureEscalation({
                toEmail,
                tenantName: tenantAdmin?.clinic_name || tenantAdmin?.full_name,
                leadName: lead?.name,
                channel: conversation.channel,
                conversationId,
                collected: capture.nextState?.collected || {},
                missing: capture.missing || [],
                recentMessages: recent
                  .map((m) => ({ sender: m.sender_type, text: m.text }))
                  .reverse(),
              });
            } catch (mailErr) {
              log.error(MODULE, "sendMessage:captureEscalation", {
                error: mailErr.message,
                conversationId,
              });
            }
          }
        }
      }

      // AI responds if tenant has configured this intent for AI reply — source of truth
      if (!captureHandled && conversation.ai_enabled && aiRespondsTo.includes(intent)) {
        // Check FAQs first — if matched, use predefined answer instead of OpenAI
        const allHistory = await Message.findAll({
          where: { conversation_id: conversationId },
          order: [["created_at", "ASC"]],
          attributes: ["sender_type", "text"],
        });
        // Exclude the just-saved patient message to avoid adding it twice
        const history = allHistory.slice(0, -1);
        const faqAnswer = await matchFAQ(text, tenantId);
        // toolContext enables the booking tool loop inside generateAIResponse
        // (see BOOKING_TOOLS/TOOL_HANDLERS above). FAQ-matched replies never
        // enter the tool loop — booking only triggers via the plain
        // generateAIResponse branch, consistent with FAQ being reserved for
        // static Q&A.
        const toolContext = { tenantId, leadId: conversation.lead_id, conversationId };
        const aiText = faqAnswer
          ? await rephraseFAQAnswer({ patientText: text, faqAnswer, intent, aiSettings })
          : await generateAIResponse(text, intent, aiSettings, history, [], toolContext);
        const aiMsg = await Message.create({
          conversation_id: conversationId,
          sender_type: "ai",
          sender_id: null,
          receiver_id: null,
          receiver_type: "patient",
          text: aiText,
          metadata: { intent, auto_reply: true, faq_matched: !!faqAnswer },
        });
        messages.push(aiMsg);

        let aiLead = await Lead.findByPk(conversation.lead_id);
        aiLead = await maybeMarkLeadWonFromOutgoingConfirmation({
          lead: aiLead,
          conversation,
          text: aiText,
        });

        // Dispatch AI reply to the patient's real channel (WhatsApp / Instagram)
        try {
          const lead = await Lead.findByPk(conversation.lead_id, { attributes: ["id", "name", "phone", "notes"] });
          const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
          const recipientId = resolveChannelRecipientId(lead, conversation.channel);
          if (recipientId && (conversation.channel === "WhatsApp" || conversation.channel === "Instagram")) {
            await sendOutbound(conversation.channel, setting, recipientId, aiText, { conversation });
            log.info(MODULE, "sendMessage:aiChannelDispatch", { conversationId, channel: conversation.channel, to: recipientId });
          }
        } catch (channelErr) {
          log.error(MODULE, "sendMessage:aiChannelDispatch", { error: channelErr.message, conversationId });
        }

        // escalate_low_confidence setting → flag low intent for staff
        if (intent === "low" && aiSettings.escalate_low_confidence) {
          conversation.status = "pending";
        }
      }

      // Send email notification if this intent level is configured for email alerts.
      // Suppressed while the capture flow is actively prompting / collecting so
      // the admin only gets the focused escalation email (or none if completed).
      if (!captureHandled && emailNotifyFor.includes(intent) && aiSettings.notification_email) {
        const lead = await Lead.findByPk(conversation.lead_id, { attributes: ["name"] });
        await sendIntentNotification({
          toEmail: aiSettings.notification_email,
          intent,
          leadName: lead?.name,
          channel: conversation.channel,
          conversationId,
        });
      }

      if (lead) {
        const beforeConsistencyStage = lead.stage;
        const beforeConsistencyScore = lead.score;
        await enforceLeadScoreStageConsistency(lead);
        logLeadAutomationDebug("patientMessage:afterConsistency", {
          conversationId,
          leadId: lead?.id,
          senderType: "patient",
          channel: conversation.channel,
          intent,
          beforeStage: beforeConsistencyStage,
          afterStage: lead?.stage,
          beforeScore: beforeConsistencyScore,
          afterScore: lead?.score,
        });
      }
      await conversation.save();

    } else {
      // ── Human staff/admin sends a reply ──────────────────────
      let lead = await Lead.findByPk(conversation.lead_id);
      const humanMsg = await Message.create({
        conversation_id: conversationId,
        sender_type: "human",
        sender_id: req.user.id,
        receiver_id: null,
        receiver_type: "patient",
        text: text.trim(),
        metadata: {},
      });
      messages.push(humanMsg);

      conversation.last_message_at = new Date();
      conversation.unread_count = 0;

      lead = await maybeMarkLeadWonFromOutgoingConfirmation({
        lead,
        conversation,
        text: text.trim(),
      });

      await conversation.save();

      // ── Dispatch to real channel (WhatsApp / Instagram) ──────
      if (conversation.channel === "WhatsApp" || conversation.channel === "Instagram") {
        try {
          lead = await Lead.findByPk(conversation.lead_id, { attributes: ["id", "name", "phone", "notes"] });
          const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
          const recipientId = resolveChannelRecipientId(lead, conversation.channel);

          if ((conversation.channel === "WhatsApp" || conversation.channel === "Instagram") && recipientId) {
            await sendOutbound(conversation.channel, setting, recipientId, text.trim(), { conversation });
            log.info(MODULE, "sendMessage:channelDispatch", { conversationId, channel: conversation.channel, to: recipientId });
          } else if (conversation.channel === "WhatsApp" || conversation.channel === "Instagram") {
            log.warn(MODULE, "sendMessage:channelDispatch", { message: "Missing recipient", conversationId });
          }
        } catch (channelErr) {
          // Message is already saved in DB — log the delivery failure but don't fail the request
          log.error(MODULE, "sendMessage:channelDispatch", { error: channelErr.message, conversationId });
        }
      }
    }

    const data = messages.map((m) => ({
      id: String(m.id),
      conversationId: String(m.conversation_id),
      sender: m.sender_type,
      senderName: m.sender_type === "patient"
        ? "Patient"
        : m.sender_type === "ai"
        ? "AI Assistant"
        : req.user.full_name || "Staff",
      senderId: m.sender_id,
      text: m.text,
      attachments: m.attachments || [],
      metadata: m.metadata,
      timestamp: m.createdAt,
    }));

    log.info(MODULE, "sendMessage", {
      userId: req.user.id,
      conversationId,
      type,
      messageCount: data.length,
    });

    return res.status(201).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "sendMessage", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Toggle AI on/off (handover) ────────────────────────────────────
exports.toggleAI = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, is_deleted: false },
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    if (!canAccessConversation(req.user, conversation)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    conversation.ai_enabled = !conversation.ai_enabled;
    await conversation.save();

    log.info(MODULE, "toggleAI", { conversationId: conversation.id, aiEnabled: conversation.ai_enabled });
    return res.status(200).json({
      success: true,
      message: conversation.ai_enabled ? "AI enabled." : "AI disabled — human handover.",
      data: { ai_enabled: conversation.ai_enabled },
    });
  } catch (err) {
    log.error(MODULE, "toggleAI", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update conversation status ─────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status, assigned_to, custom_data } = req.body;
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, is_deleted: false },
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    if (!canAccessConversation(req.user, conversation)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (status) conversation.status = status;
    if (assigned_to !== undefined) conversation.assigned_to = assigned_to;
    if (custom_data !== undefined && typeof custom_data === "object") {
      conversation.custom_data = { ...(conversation.custom_data ?? {}), ...custom_data };
    }
    await conversation.save();

    log.info(MODULE, "updateStatus", { conversationId: conversation.id, status, assigned_to });
    return res.status(200).json({ success: true, message: "Conversation updated." });
  } catch (err) {
    log.error(MODULE, "updateStatus", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Mark as read ───────────────────────────────────────────────────
exports.markRead = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      where: { id: req.params.id, is_deleted: false },
    });
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found." });
    }

    if (!canAccessConversation(req.user, conversation)) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    conversation.unread_count = 0;
    await conversation.save();

    return res.status(200).json({ success: true, message: "Marked as read." });
  } catch (err) {
    log.error(MODULE, "markRead", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
