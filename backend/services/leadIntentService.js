const { createOpenAI } = require("../utils/openaiClient");
const { AISetting } = require("../models");
const log = require("../utils/logger");

const MODULE = "LeadIntentService";

const STAGE_RANK = {
  new: 0,
  qualified: 1,
  discussion: 2,
  won: 3,
  lost: 3,
};

const STAGE_FLOOR = {
  new: 0,
  qualified: 25,
  discussion: 50,
  won: 80,
  lost: 0,
};

const FALLBACK_PATTERNS = {
  high: /\b(book|booking|booked|schedule|scheduled|appointment|appointments|slot|visit|come in|consultation|consult|reserve|reserved|confirm|confirmed|asap|urgent|today|tomorrow|right away|immediately|soon)\b/i,
  medium: /\b(price|pricing|cost|charge|fee|package|quotation|quote|how much|details|detail|information|info|procedure|process|treatment|plan|options|available)\b/i,
  booking: /\b(book|booking|booked|schedule|scheduled|appointment|appointments|slot|visit|come in|consultation|consult|reserve|reserved|confirm|confirmed)\b/i,
  explicitWon: /\b(booked successfully|appointment (is )?confirmed|appointment (is )?booked|booking confirmed|slot confirmed|i booked|i have booked|it is booked|it is confirmed|see you (today|tomorrow|soon)|deposit paid|payment done for booking)\b/i,
  availability: /\b(availability|doctor available|dates available|time available|slot available|when can i come|when are you available|what time|which day|date|dates|timing|timings|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|next week|this week|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2}|(january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2}|may\s+\d{1,2})\b/i,
  pricing: /\b(price|pricing|cost|charge|fee|package|quotation|quote|how much)\b/i,
  details: /\b(details|detail|information|info|procedure|process|treatment|plan|options|available)\b/i,
  urgency: /\b(asap|urgent|today|tomorrow|right away|immediately|soon)\b/i,
  positive: /\b(yes|okay|ok|sure|interested|sounds good|let's do|i want|would like|booked|confirmed|successfully booked|done)\b/i,
  negative: /\b(not interested|no thanks|don't contact|do not contact|stop|leave me alone|cancel|not now|stop messaging|stop contacting|unsubscribe)\b/i,
  hardNegative: /\b(not interested|no thanks|don't contact|do not contact|leave me alone|stop messaging|stop contacting|unsubscribe)\b/i,
  delay: /\b(not now|maybe later|later|will think|i will think|need to think|let me think|after some time|not ready)\b/i,
  budgetObjection: /\b(too expensive|expensive|costly|high price|out of budget|can't afford|cannot afford)\b/i,
  passiveReply: /^(ok|okay|k|kk|thanks|thank you|hmm|hmmm|noted|fine|sure|yes|yep|yeah)[!. ]*$/i,
  greetingOnly: /^(hi|hello|hey|good morning|good afternoon|good evening)[!. ]*$/i,
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  return fallback;
};

const normalizeStage = (value, fallback = "new") => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return ["new", "qualified", "discussion", "won", "lost"].includes(normalized) ? normalized : fallback;
};

const clampScore = (value, fallback = 10) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numeric)));
};

const applyAutomationGuards = ({
  currentStage = "new",
  currentScore = 0,
  recommendedStage = "new",
  recommendedScore = 10,
}) => {
  const safeCurrentStage = normalizeStage(currentStage, "new");
  const safeRecommendedStage = normalizeStage(recommendedStage, safeCurrentStage);
  const currentRank = STAGE_RANK[safeCurrentStage] ?? 0;
  const recommendedRank = STAGE_RANK[safeRecommendedStage] ?? currentRank;

  // Never downgrade stage once a lead has progressed.
  const guardedStage = recommendedRank < currentRank ? safeCurrentStage : safeRecommendedStage;
  const stageFloor = STAGE_FLOOR[guardedStage] ?? 0;

  // Never downgrade score either. Preserve the highest validated score.
  const guardedScore = Math.max(
    clampScore(currentScore, 0),
    clampScore(recommendedScore, 10),
    stageFloor
  );

  return { stage: guardedStage, score: guardedScore };
};

const fallbackClassification = ({
  text,
  currentStage = "new",
  currentScore = 0,
  fallbackIntent = "low",
}) => {
  const normalized = String(text || "").trim().toLowerCase();
  const intent =
    FALLBACK_PATTERNS.high.test(normalized)
      ? "high"
      : FALLBACK_PATTERNS.medium.test(normalized)
        ? "medium"
        : fallbackIntent || "low";

  const signals = {
    hasBookingIntent: FALLBACK_PATTERNS.booking.test(normalized),
    hasExplicitWonIntent: FALLBACK_PATTERNS.explicitWon.test(normalized),
    hasAvailabilityIntent: FALLBACK_PATTERNS.availability.test(normalized),
    hasPricingIntent: FALLBACK_PATTERNS.pricing.test(normalized),
    hasDetailIntent: FALLBACK_PATTERNS.details.test(normalized),
    hasUrgencyIntent: FALLBACK_PATTERNS.urgency.test(normalized),
    hasPositiveIntent: FALLBACK_PATTERNS.positive.test(normalized),
    hasNegativeIntent: FALLBACK_PATTERNS.negative.test(normalized),
    hasHardNegativeIntent: FALLBACK_PATTERNS.hardNegative.test(normalized),
    hasDelayIntent: FALLBACK_PATTERNS.delay.test(normalized),
    hasBudgetObjection: FALLBACK_PATTERNS.budgetObjection.test(normalized),
    hasPassiveReply: FALLBACK_PATTERNS.passiveReply.test(normalized),
    hasGreetingOnly: FALLBACK_PATTERNS.greetingOnly.test(normalized),
  };

  let recommendedStage = currentStage || "new";
  let recommendedScore = currentScore || 0;

  if (signals.hasExplicitWonIntent) {
    recommendedStage = "won";
    recommendedScore = Math.max(recommendedScore, 85);
  } else if (intent === "high" || signals.hasBookingIntent || signals.hasUrgencyIntent) {
    recommendedStage = "discussion";
    recommendedScore = Math.max(recommendedScore, 55);
  } else if (intent === "medium" || signals.hasPricingIntent || signals.hasDetailIntent) {
    recommendedStage = "qualified";
    recommendedScore = Math.max(recommendedScore, 30);
  } else {
    recommendedStage = "new";
    recommendedScore = Math.max(recommendedScore, 10);
  }

  const guarded = applyAutomationGuards({
    currentStage,
    currentScore,
    recommendedStage,
    recommendedScore,
  });

  return {
    translatedText: String(text || "").trim(),
    intent,
    signals,
    recommended: guarded,
  };
};

const classifyLeadIntent = async ({
  tenantId,
  text,
  currentStage = "new",
  currentScore = 0,
  fallbackIntent = "low",
  conversationHistory = [],
}) => {
  const fallback = fallbackClassification({
    text,
    currentStage,
    currentScore,
    fallbackIntent,
  });
  const normalizedText = String(text || "").trim();
  if (!tenantId || !normalizedText) return fallback;

  try {
    const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
    if (!setting?.openai_api_key) return fallback;

    const openai = createOpenAI(setting.openai_api_key, setting.openai_base_url);

    // Build a compact conversation history block so the AI has context for
    // short replies like "yes", "ok", "sure", or any single-word confirmation
    // in any language (e.g. "ہاں", "نعم", "हाँ").
    const historyBlock =
      Array.isArray(conversationHistory) && conversationHistory.length > 0
        ? `\nRecent conversation (oldest first, for context only):\n${conversationHistory
            .map((m) => `[${m.role === "patient" ? "Patient" : "Clinic"}]: ${m.text}`)
            .join("\n")}\n`
        : "";

    const prompt = `You are classifying a patient CRM message for lead stage automation.

The patient may write in any language. Understand the message meaning in context, then apply the rules below.

Current lead stage: ${normalizeStage(currentStage, "new")}
Current lead score: ${clampScore(currentScore, 0)}
${historyBlock}
Latest patient message:
"""${normalizedText}"""

Return strict JSON only with this exact shape:
{
  "translatedText": "English translation of the latest patient message",
  "intent": "low" | "medium" | "high",
  "signals": {
    "hasBookingIntent": boolean,
    "hasExplicitWonIntent": boolean,
    "hasAvailabilityIntent": boolean,
    "hasPricingIntent": boolean,
    "hasDetailIntent": boolean,
    "hasUrgencyIntent": boolean,
    "hasPositiveIntent": boolean,
    "hasNegativeIntent": boolean,
    "hasHardNegativeIntent": boolean,
    "hasDelayIntent": boolean,
    "hasBudgetObjection": boolean,
    "hasPassiveReply": boolean,
    "hasGreetingOnly": boolean
  },
  "recommended": {
    "stage": "new" | "qualified" | "discussion" | "won" | "lost",
    "score": number
  }
}

Signal definitions (apply to the LATEST message in the context of the conversation above):
- hasBookingIntent: patient wants to book, schedule, or is discussing an appointment (NOT yet confirmed — use for discussion stage)
- hasExplicitWonIntent: the booking is ALREADY DONE — patient uses past tense ("I've booked", "it's confirmed", "slot confirmed", "payment done for booking"). Do NOT set this true just because the patient agrees to a date or says "yes" to a booking suggestion.
- hasAvailabilityIntent: patient asks about availability, timing, dates, or provides date/time details
- hasPricingIntent: patient asks about price, cost, fee, package, or quote
- hasDetailIntent: patient asks for treatment details, procedures, options, or information
- hasUrgencyIntent: patient expresses urgency (asap, urgent, right away, immediately, or equivalent in any language)
- hasPositiveIntent: patient expresses interest, agreement, or willingness to proceed
- hasNegativeIntent: patient is rejecting the clinic as a whole (not just declining one offer)
- hasHardNegativeIntent: strong opt-out ("don't contact me", "unsubscribe", "leave me alone")
- hasDelayIntent: patient says they need time, will think about it, or wants to be contacted later
- hasBudgetObjection: patient says the price is too high or they cannot afford it
- hasPassiveReply: the latest message is only a short acknowledgment ("ok", "thanks", "noted", "seen", "fine", or equivalent) with no new intent
- hasGreetingOnly: the latest message is only a greeting with no other content ("hi", "hello", "hey", or equivalent in any language)

Stage rules:
- new: first contact, greeting, weak interest, or unclear intent.
- qualified: real treatment interest, pricing questions, detail questions, or useful qualification info.
- discussion: patient is actively discussing booking — asking about date/time, providing a preferred date/time, agreeing to a suggested slot, saying "yes" to a booking, or any booking-related exchange that has NOT yet been confirmed as completed.
- won: the booking is fully confirmed and done — the clinic confirmed the appointment AND the patient acknowledged it, OR the patient explicitly states the booking IS already confirmed/booked (past tense, completed action). NOT when the patient merely agrees to or requests a booking.
- lost: explicit opt-out from the clinic as a whole.

Score rules:
- low intent usually stays near 10-20.
- medium intent usually stays near 25-49.
- discussion/high intent usually stays near 50-79.
- won should be 80-100, usually at least 85.
- lost should stay very low.

Critical safety rules:
- Use the translated meaning, not literal keywords from the original language.
- Use the conversation history above to interpret short replies in context.
- Even if the clinic asked "what date?" and the patient replied with a date — that is discussion stage, NOT won. The booking is still being arranged.
- hasExplicitWonIntent must NEVER be set true just because the patient agreed to a date/time or said "yes" to a booking offer. It is ONLY true when the patient uses language that means the booking IS ALREADY DONE: "confirmed", "booked", "appointment confirmed", "it's set", "slot confirmed", "payment done".
- Never recommend a lower stage than the current stage.
- Never recommend a score lower than the current score.
- If the patient provides a date/time preference or says yes to a booking suggestion, recommend stage="discussion" (NOT "won") — the booking is not yet confirmed.
- Only recommend stage="won" when the booking is explicitly stated as COMPLETED/CONFIRMED (past tense), not when the patient is merely agreeing to or requesting a booking.
- Mark hasNegativeIntent true ONLY when the patient is rejecting further contact with the clinic as a whole.
- Mark hasHardNegativeIntent true only for strong opt-out messages like "don't contact me", "unsubscribe", "leave me alone", "not interested in your clinic".
- A simple "no", "thanks", or declining one specific offer is not a clinic opt-out.
- Do not downgrade a lead from won.
- Keep scores consistent with stage floors:
  - new >= 0
  - qualified >= 25
  - discussion >= 50
  - won >= 80
  - lost >= 0`;

    const completion = await openai.chat.completions.create({
      model: setting.openai_model || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const intent = ["low", "medium", "high"].includes(parsed?.intent) ? parsed.intent : fallback.intent;
    const aiSignals = parsed?.signals || {};
    const translatedText = typeof parsed?.translatedText === "string" && parsed.translatedText.trim()
      ? parsed.translatedText.trim()
      : fallback.translatedText;

    const guarded = applyAutomationGuards({
      currentStage,
      currentScore,
      recommendedStage: parsed?.recommended?.stage,
      recommendedScore: parsed?.recommended?.score,
    });

    return {
      translatedText,
      intent,
      signals: {
        hasBookingIntent: normalizeBoolean(aiSignals.hasBookingIntent, fallback.signals.hasBookingIntent),
        hasExplicitWonIntent: normalizeBoolean(aiSignals.hasExplicitWonIntent, fallback.signals.hasExplicitWonIntent),
        hasAvailabilityIntent: normalizeBoolean(aiSignals.hasAvailabilityIntent, fallback.signals.hasAvailabilityIntent),
        hasPricingIntent: normalizeBoolean(aiSignals.hasPricingIntent, fallback.signals.hasPricingIntent),
        hasDetailIntent: normalizeBoolean(aiSignals.hasDetailIntent, fallback.signals.hasDetailIntent),
        hasUrgencyIntent: normalizeBoolean(aiSignals.hasUrgencyIntent, fallback.signals.hasUrgencyIntent),
        hasPositiveIntent: normalizeBoolean(aiSignals.hasPositiveIntent, fallback.signals.hasPositiveIntent),
        hasNegativeIntent: normalizeBoolean(aiSignals.hasNegativeIntent, fallback.signals.hasNegativeIntent),
        hasHardNegativeIntent: normalizeBoolean(aiSignals.hasHardNegativeIntent, fallback.signals.hasHardNegativeIntent),
        // Extended signals — now returned by the AI so they work in any language.
        // Fall back to English regex only when the AI key is unavailable.
        hasDelayIntent: normalizeBoolean(aiSignals.hasDelayIntent, fallback.signals.hasDelayIntent),
        hasBudgetObjection: normalizeBoolean(aiSignals.hasBudgetObjection, fallback.signals.hasBudgetObjection),
        hasPassiveReply: normalizeBoolean(aiSignals.hasPassiveReply, fallback.signals.hasPassiveReply),
        hasGreetingOnly: normalizeBoolean(aiSignals.hasGreetingOnly, fallback.signals.hasGreetingOnly),
      },
      recommended: guarded,
    };
  } catch (err) {
    log.warn(MODULE, "classifyLeadIntent", { tenantId, error: err.message });
    return fallback;
  }
};

module.exports = { classifyLeadIntent };
