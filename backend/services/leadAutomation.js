const { Op } = require("sequelize");
const { Lead, LeadSummary, Conversation } = require("../models");
const { triggerLeadSummary } = require("./leadSummaryService");
const { classifyLeadIntent } = require("./leadIntentService");

const STAGE_RANK = {
  new: 0,
  qualified: 1,
  discussion: 2,
  won: 3,
  lost: 3,
};

const INTENT_RANK = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const PLACEHOLDER_NAME_PATTERNS = [
  /^instagram user/i,
  /^whatsapp user/i,
  /^web chat user/i,
  /^lead$/i,
  /^unknown$/i,
];

const SIGNAL_PATTERNS = {
  booking: /\b(book|booking|booked|schedule|scheduled|appointment|appointments|slot|visit|come in|consultation|consult|reserve|reserved|confirm|confirmed)\b/i,
  explicitWon: /\b(booked successfully|appointment (is )?confirmed|appointment (is )?booked|booking confirmed|slot confirmed|i booked|i have booked|it is booked|it is confirmed|see you (today|tomorrow|soon)|deposit paid|payment done for booking)\b/i,
  // Matches both availability *questions* ("what time", "which day") and
  // date/time *answers* a patient provides when the bot asks for booking details
  // (day names, "May 12", "3pm", "morning", "next week", etc.).
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

const NON_NAME_PATTERNS = [
  SIGNAL_PATTERNS.booking,
  SIGNAL_PATTERNS.pricing,
  SIGNAL_PATTERNS.details,
  SIGNAL_PATTERNS.urgency,
  SIGNAL_PATTERNS.negative,
  /\b(hello|hi|hey|thanks|thank you|okay|ok|yes|no)\b/i,
];

const GLOBAL_NAME_TOKEN = String.raw`\p{L}[\p{L}\p{M}'’.\\-]*`;
const EMBEDDED_NAME_PATTERNS = [
  new RegExp(`\\b(?:my\\s*name\\s*is|i\\s*am|i['â€™]m|this\\s*is|name\\s*[:\\-]\\s*|call\\s*me)\\s+(${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,3})`, "iu"),
  new RegExp(`\\b(?:it's|it is)\\s+(${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,3})\\b`, "iu"),
  new RegExp(`\\b(?:you can call me|reach me as)\\s+(${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,3})`, "iu"),
];
const STANDALONE_NAME_RE = new RegExp(`^${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,2}$`, "iu");

const cleanString = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || null;
};

const normalizeEmail = (value) => {
  const cleaned = cleanString(value);
  return cleaned ? cleaned.toLowerCase() : null;
};

const normalizePhoneCandidate = (value) => {
  const cleaned = cleanString(value);
  if (!cleaned) return null;

  const normalized = cleaned.replace(/[^\d+]/g, "");
  const digitCount = normalized.replace(/\D/g, "").length;
  return digitCount >= 7 ? normalized : null;
};

const buildChannelMarker = (channel, identifier) => {
  const safeChannel = cleanString(channel)?.toLowerCase();
  const safeIdentifier = cleanString(identifier);
  if (!safeChannel || !safeIdentifier) return null;
  return `[channel-id:${safeChannel}:${safeIdentifier}]`;
};

const ensureChannelMarker = (notes, channel, identifier) => {
  const marker = buildChannelMarker(channel, identifier);
  if (!marker) return notes || null;
  if ((notes || "").includes(marker)) return notes || marker;
  return notes ? `${marker}\n${notes}` : marker;
};

const extractChannelRecipientIdFromNotes = (notes, channel) => {
  const safeChannel = cleanString(channel)?.toLowerCase();
  if (!safeChannel || !notes) return null;

  const matcher = new RegExp(`\\[channel-id:${safeChannel}:([^\\]]+)\\]`, "i");
  const found = notes.match(matcher);
  return found?.[1] ? cleanString(found[1]) : null;
};

const isPlaceholderLeadName = (name, primaryIdentifier = null) => {
  const cleaned = cleanString(name);
  if (!cleaned) return true;
  if (primaryIdentifier && cleaned === primaryIdentifier) return true;
  return PLACEHOLDER_NAME_PATTERNS.some((pattern) => pattern.test(cleaned));
};

const extractEmail = (text) => {
  const match = cleanString(text)?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return normalizeEmail(match?.[0] || null);
};

const extractPhone = (text) => {
  const matches = cleanString(text)?.match(/(?:\+?\d[\d\s().-]{6,}\d)/g) || [];
  for (const candidate of matches) {
    const normalized = normalizePhoneCandidate(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const extractName = (text) => {
  const cleaned = cleanString(text);
  if (!cleaned) return null;

  for (const pattern of EMBEDDED_NAME_PATTERNS) {
    const match = cleaned.match(pattern);
    const candidate = cleanString(match?.[1]);
    if (candidate) return candidate;
  }

  // Handle short standalone replies like "Ravi" or "Ravi Patel".
  if (
    cleaned.length <= 40 &&
    !/@/.test(cleaned) &&
    !/\d/.test(cleaned) &&
    !NON_NAME_PATTERNS.some((pattern) => pattern.test(cleaned)) &&
    STANDALONE_NAME_RE.test(cleaned)
  ) {
    return cleaned;
  }

  return null;
};

const extractLeadDetails = (text, fallbackName = null) => ({
  name: extractName(text) || cleanString(fallbackName),
  email: extractEmail(text),
  phone: extractPhone(text),
});

const detectSignals = (text, extras = {}) => {
  const normalized = cleanString(text) || "";
  const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

  return {
    hasBookingIntent: SIGNAL_PATTERNS.booking.test(normalized),
    hasExplicitWonIntent: SIGNAL_PATTERNS.explicitWon.test(normalized),
    hasAvailabilityIntent: SIGNAL_PATTERNS.availability.test(normalized),
    hasPricingIntent: SIGNAL_PATTERNS.pricing.test(normalized),
    hasDetailIntent: SIGNAL_PATTERNS.details.test(normalized),
    hasUrgencyIntent: SIGNAL_PATTERNS.urgency.test(normalized),
    hasPositiveIntent: SIGNAL_PATTERNS.positive.test(normalized),
    hasNegativeIntent: SIGNAL_PATTERNS.negative.test(normalized),
    hasHardNegativeIntent: SIGNAL_PATTERNS.hardNegative.test(normalized),
    hasDelayIntent: SIGNAL_PATTERNS.delay.test(normalized),
    hasBudgetObjection: SIGNAL_PATTERNS.budgetObjection.test(normalized),
    hasPassiveReply: SIGNAL_PATTERNS.passiveReply.test(normalized),
    hasGreetingOnly: SIGNAL_PATTERNS.greetingOnly.test(normalized),
    hasAttachments: !!extras.hasAttachments,
    hasSharedContactDetails: !!extras.hasSharedContactDetails,
    wordCount,
  };
};

const resolveLeadName = ({ currentName, extractedName, fallbackName, primaryIdentifier, channel }) => {
  if (!isPlaceholderLeadName(currentName, primaryIdentifier)) return cleanString(currentName);
  if (cleanString(extractedName)) return cleanString(extractedName);
  if (cleanString(fallbackName)) return cleanString(fallbackName);
  if (channel === "Instagram" && primaryIdentifier) return `Instagram User ${primaryIdentifier}`;
  if (channel === "WhatsApp" && primaryIdentifier) return primaryIdentifier;
  return cleanString(currentName) || "New Lead";
};

// Stage floor scores â€” ensures score never drops below stage minimum
const STAGE_FLOOR = {
  new: 0,
  qualified: 25,
  discussion: 50,
  won: 80,
  lost: 0,
};

// Default scores used when no signal context is available (e.g. manual stage set)
const STAGE_DEFAULT_SCORE = {
  new: 10,
  qualified: 30,
  discussion: 60,
  won: 85,
  lost: 5,
};

const getStageFallbackScore = (stage) => STAGE_DEFAULT_SCORE[stage] ?? 10;
const getPinnedIntent = (currentIntent = "unknown", nextIntent = "unknown") =>
  (INTENT_RANK[nextIntent] ?? 0) >= (INTENT_RANK[currentIntent] ?? 0) ? nextIntent : currentIntent;

/**
 * Dynamically calculate a 0â€“100 score based on intent and behavioural signals.
 *
 * Score bands:
 *   0â€“20   Low intent
 *   20â€“50  Medium intent
 *   50â€“80  High intent
 *   80â€“100 HOT lead
 */
const calculateDynamicScore = ({ intent, signals, stage, isFirstInboundMessage = false, currentScore = 0 }) => {
  if (signals.hasHardNegativeIntent || stage === "lost") return 5;

  // Base score by intent band
  let score;
  if (intent === "high")        score = 55;
  else if (intent === "medium") score = 30;
  else                          score = 10;

  // Signal bonuses (engagement & action depth)
  if (signals.hasDetailIntent)         score += 8;
  if (signals.hasPricingIntent)        score += 10;
  if (signals.hasAttachments)          score += 10;
  if (signals.hasSharedContactDetails) score += 12;
  if (signals.hasAvailabilityIntent)   score += 10;
  if (signals.hasBookingIntent)        score += 15;
  if (signals.hasUrgencyIntent)        score += 10;
  if (signals.hasPositiveIntent)       score += 8;
  if (signals.wordCount > 20)          score += 5;

  if (signals.hasDelayIntent)          score -= 10;
  if (signals.hasBudgetObjection)      score -= 12;

  // Only suppress passive/short replies at the very start of a conversation.
  // Once in qualified or discussion, "yes"/"ok" are confirmations, not disengagement.
  if (signals.hasPassiveReply && signals.wordCount <= 3 && stage === "new") {
    score = Math.min(score, 12);
  }

  if (signals.hasGreetingOnly && !signals.hasDetailIntent && !signals.hasPricingIntent && !signals.hasBookingIntent) {
    score = Math.min(score, 10);
  }

  if (signals.hasExplicitWonIntent) {
    score = Math.max(score, 85);
  }
  if (signals.hasBookingIntent && !signals.hasExplicitWonIntent) {
    score = Math.min(score, 75);
  }

  const hasStrongEarlySignal =
    signals.hasPricingIntent ||
    signals.hasDetailIntent ||
    signals.hasBookingIntent ||
    signals.hasUrgencyIntent ||
    signals.hasExplicitWonIntent ||
    signals.hasAttachments ||
    signals.hasSharedContactDetails;
  if (isFirstInboundMessage && !hasStrongEarlySignal) {
    score = Math.min(score, 20);
  }

  // Clamp to valid range
  score = Math.min(100, Math.max(0, score));

  // Enforce stage floor â€” never let score drop below what stage implies
  const floor = STAGE_FLOOR[stage] ?? 0;
  score = Math.max(floor, score);

  // Progressive scoring â€” applies to every message after the first, across all stages.
  if (!isFirstInboundMessage) {
    const hasNegativeSignal = signals.hasHardNegativeIntent || signals.hasDelayIntent || signals.hasBudgetObjection;
    if (!hasNegativeSignal) {
      // Rule 1: score never regresses â€” preserve the highest score the patient has reached.
      // Applies to every stage so e.g. new-stage 18 can never drop back to 10.
      score = Math.max(score, currentScore);

      // Rule 2: +5 incremental bump on each positive engagement â€” qualified and discussion only.
      // new stage is excluded: score there must reflect actual intent/signals, not bumps,
      // so it doesn't inflate to the ceiling (24) after just 1-2 messages.
      // Ceiling per stage keeps bumps within the band â€” promotion requires real signals.
      //   qualified  â†’ ceiling 49  (floor 25, discussion starts at 50)
      //   discussion â†’ ceiling 79  (floor 50, won confirmation sets 85)
      if (stage === "qualified" || stage === "discussion") {
        const hasPositiveEngagement =
          signals.hasPositiveIntent ||
          signals.hasBookingIntent ||
          signals.hasAvailabilityIntent ||
          signals.hasDetailIntent ||
          signals.hasPricingIntent ||
          signals.hasUrgencyIntent ||
          signals.hasSharedContactDetails ||
          signals.hasAttachments;
        if (hasPositiveEngagement) {
          const stageCeiling = stage === "qualified" ? 49 : 79;
          score = Math.min(score + 5, stageCeiling);
        }
      }
    }
  }

  return score;
};

const normalizeScoreForStage = (_score, stage) => getStageFallbackScore(stage);

const clampScoreToBand = (score, min, max) => Math.min(max, Math.max(min, Math.round(score)));

const getDeterministicStageAndScore = ({
  currentStage = "new",
  currentScore = 0,
  signals,
  isFirstInboundMessage = false,
}) => {
  const safeCurrentStage = currentStage || "new";
  let nextStage = safeCurrentStage;
  let nextScore = Math.max(currentScore || 0, STAGE_FLOOR[safeCurrentStage] ?? 0);

  if (safeCurrentStage === "won") {
    return {
      stage: "won",
      score: Math.max(nextScore, 85),
    };
  }

  const hasPositiveReply =
    signals.hasPositiveIntent ||
    signals.hasPassiveReply;
  const hasQualificationSignal =
    signals.hasSharedContactDetails ||
    signals.hasPricingIntent ||
    signals.hasDetailIntent;
  // Images (hasAttachments) indicate the patient is actively engaged and sharing
  // medical information — treat as a discussion-level signal, not just qualification.
  const hasDiscussionSignal =
    signals.hasAvailabilityIntent ||
    signals.hasBookingIntent ||
    signals.hasUrgencyIntent ||
    signals.hasAttachments;
  // Any booking-related message (asking for date/time, agreeing to a slot,
  // saying yes to booking) stays in discussion.  Only an explicit confirmed
  // booking ("booked", "appointment confirmed", "slot confirmed") reaches won.
  const hasWonSignal = signals.hasExplicitWonIntent;

  if (hasWonSignal) {
    return {
      stage: "won",
      score: Math.max(nextScore, 85),
    };
  }

  if (safeCurrentStage === "new") {
    if (isFirstInboundMessage) {
      nextScore = Math.max(nextScore, 10);
    }

    if (hasDiscussionSignal) {
      nextStage = "discussion";
      nextScore = Math.max(nextScore, signals.hasAvailabilityIntent ? 50 : 45);
    } else if (hasQualificationSignal) {
      nextStage = "qualified";
      nextScore = Math.max(nextScore, 25);
    } else if (hasPositiveReply) {
      nextScore = clampScoreToBand(Math.max(nextScore, 10) + 5, 10, 24);
    } else {
      nextScore = Math.max(nextScore, 10);
    }
  } else if (safeCurrentStage === "qualified") {
    nextScore = Math.max(nextScore, 25);

    if (hasDiscussionSignal) {
      nextStage = "discussion";
      nextScore = Math.max(nextScore, signals.hasAvailabilityIntent ? 50 : 45);
    } else if (hasPositiveReply || hasQualificationSignal) {
      nextScore = clampScoreToBand(Math.max(nextScore, 25) + 5, 25, 44);
    }
  } else if (safeCurrentStage === "discussion") {
    nextScore = Math.max(nextScore, 45);

    if (signals.hasAvailabilityIntent) {
      nextScore = Math.max(nextScore, 50);
    }
    if (hasPositiveReply || hasDiscussionSignal || hasQualificationSignal) {
      nextScore = clampScoreToBand(Math.max(nextScore, 45) + 5, 45, 79);
    }
  } else if (safeCurrentStage === "lost") {
    if (hasQualificationSignal || hasDiscussionSignal || hasPositiveReply) {
      nextStage = hasDiscussionSignal ? "discussion" : "qualified";
      nextScore = Math.max(nextScore, nextStage === "discussion" ? 45 : 25);
    }
  }

  nextScore = Math.max(nextScore, STAGE_FLOOR[nextStage] ?? 0);

  if ((STAGE_RANK[nextStage] ?? 0) < (STAGE_RANK[safeCurrentStage] ?? 0)) {
    nextStage = safeCurrentStage;
  }
  nextScore = Math.max(nextScore, currentScore || 0);

  return { stage: nextStage, score: nextScore };
};

const applyScoreStageGuards = ({
  currentStage = "new",
  candidateStage,
  score,
  signals,
  allowAutoWon = false,
}) => {
  const currentRank = STAGE_RANK[currentStage] ?? 0;
  const candidateRank = STAGE_RANK[candidateStage] ?? 0;
  const canAutoCloseFromCurrentStage =
    allowAutoWon || currentStage === "qualified" || currentStage === "discussion";

  if (candidateStage === "won" && (!canAutoCloseFromCurrentStage || !signals.hasExplicitWonIntent || score < 80)) {
    // Can't confirm won â€” step back to current stage or one below won
    if (candidateRank > currentRank) {
      return currentStage === "new" ? "qualified" : currentStage;
    }
    return currentStage;
  }

  // Score gates only block UPWARD promotions â€” never push a stage below where it already is
  if (candidateStage === "discussion" && STAGE_RANK["discussion"] > currentRank && score < 50) {
    return "qualified";
  }
  if (candidateStage === "qualified" && STAGE_RANK["qualified"] > currentRank && score < 25) {
    return "new";
  }

  return candidateStage;
};

const getPromotedStage = ({
  currentStage = "new",
  intent,
  lead,
  primaryIdentifier,
  signals,
  allowAutoWon = false,
}) => {
  // Safety: locked and special stages
  if (currentStage === "won") return currentStage;
  // Only hard opt-outs (explicit "stop", "not interested", "unsubscribe") trigger lost from new.
  // A simple "no" to a specific offer does not count.
  if (signals.hasHardNegativeIntent && currentStage === "new") {
    return "lost";
  }

  const hasMeaningfulName = !isPlaceholderLeadName(lead?.name, primaryIdentifier);
  const hasStoredContact = !!lead?.phone || !!lead?.email;
  const hasManuallySharedContact = !!signals.hasSharedContactDetails;
  const hasQualificationSignal =
    intent === "medium" ||
    signals.hasPricingIntent ||
    signals.hasDetailIntent ||
    hasManuallySharedContact;
  // Images (hasAttachments) move the lead to discussion — the patient is sharing
  // medical photos which signals active engagement beyond initial qualification.
  const hasDiscussionSignal =
    intent === "high" ||
    signals.hasBookingIntent ||
    signals.hasUrgencyIntent ||
    signals.hasAttachments ||
    (signals.hasPricingIntent && signals.hasDetailIntent);
  const hasSchedulingContext = hasStoredContact || hasManuallySharedContact || hasMeaningfulName;
  const hasExplicitWonSignal = signals.hasExplicitWonIntent;

  // Re-open a lost lead only when the patient re-engages meaningfully.
  if (currentStage === "lost") {
    if (hasQualificationSignal || hasDiscussionSignal) return "qualified";
    return "lost";
  }

  // Stage rules:
  // - new: first contact / greeting / weak intent only
  // - qualified: real treatment interest, details/pricing/questions, photos, or shared contact details
  // - discussion: active booking or urgency conversation, but not yet confirmed
  // - won: explicit booked/confirmed language, but never directly from new
  if (currentStage === "new") {
    if (allowAutoWon && hasExplicitWonSignal && hasSchedulingContext) return "won";
    if (hasQualificationSignal || hasDiscussionSignal) return "qualified";
    return "new";
  }

  if (currentStage === "qualified") {
    if (hasExplicitWonSignal && hasSchedulingContext) return "won";
    // Use the full discussion signal set: high pinned intent (patient previously showed booking readiness),
    // availability signals (patient providing dates/times), or explicit booking/urgency/combined signals.
    if (hasDiscussionSignal || signals.hasAvailabilityIntent) return "discussion";
    return "qualified";
  }

  if (currentStage === "discussion") {
    if (hasExplicitWonSignal && hasSchedulingContext) return "won";
    return "discussion";
  }

  return currentStage;
};

const ensureLeadChannelIdentity = async (lead, channel, primaryIdentifier) => {
  if (!lead || !primaryIdentifier) return lead;

  const nextNotes = ensureChannelMarker(lead.notes, channel, primaryIdentifier);
  if (lead.notes !== nextNotes) {
    lead.notes = nextNotes;
    await lead.save();
  }

  return lead;
};

const resolveChannelRecipientId = (lead, channel) => {
  if (!lead) return null;
  return extractChannelRecipientIdFromNotes(lead.notes, channel) || lead.phone || null;
};

const findExistingLead = async ({ tenantId, channel, primaryIdentifier, email, phone }) => {
  const or = [];
  const marker = buildChannelMarker(channel, primaryIdentifier);

  if (marker) {
    or.push({ notes: { [Op.iLike]: `%${marker}%` } });
  }
  if (primaryIdentifier) {
    or.push({ phone: primaryIdentifier });
  }
  if (email) {
    or.push({ email });
  }
  if (phone) {
    or.push({ phone });
  }

  if (!or.length) return null;

  return Lead.findOne({
    where: {
      created_by: tenantId,
      is_deleted: false,
      [Op.or]: or,
    },
    order: [["created_at", "ASC"]],
  });
};

const findSoftDeletedLead = async ({ tenantId, channel, primaryIdentifier, email, phone }) => {
  const or = [];
  const marker = buildChannelMarker(channel, primaryIdentifier);

  if (marker) {
    or.push({ notes: { [Op.iLike]: `%${marker}%` } });
  }
  if (primaryIdentifier) {
    or.push({ phone: primaryIdentifier });
  }
  if (email) {
    or.push({ email });
  }
  if (phone) {
    or.push({ phone });
  }

  if (!or.length) return null;

  return Lead.findOne({
    where: {
      created_by: tenantId,
      is_deleted: true,
      [Op.or]: or,
    },
    order: [["created_at", "ASC"]],
  });
};

const upsertInboundLeadFromMessage = async ({
  existingLead = null,
  tenantId,
  channel,
  primaryIdentifier = null,
  fallbackName = null,
  text = "",
  intent = "low",
  currentIntent = "unknown",
  hasAttachments = false,
  conversationHistory = [],
}) => {
  const messageText = cleanString(text) || "";
  const extracted = extractLeadDetails(messageText, fallbackName);
  // Compute regex-based signals for non-language-sensitive fields only
  // (attachments, shared contact details, word count). Language-dependent
  // signals (booking, pricing, urgency, delay, etc.) are overridden below
  // by the AI classification which handles any language.
  const signals = detectSignals(messageText, {
    hasAttachments,
    hasSharedContactDetails: !!(extracted.email || extracted.phone),
  });

  let lead = existingLead;
  if (!lead) {
    lead = await findExistingLead({
      tenantId,
      channel,
      primaryIdentifier,
      email: extracted.email,
      phone: extracted.phone,
    });
  }

  let reopened = false;
  if (!lead) {
    lead = await findSoftDeletedLead({
      tenantId,
      channel,
      primaryIdentifier,
      email: extracted.email,
      phone: extracted.phone,
    });

    if (lead) {
      reopened = true;
      lead.is_deleted = false;
      lead.is_active = true;
    }
  }

  const source = channel || existingLead?.source || "Web Chat";
  const leadName = resolveLeadName({
    currentName: lead?.name,
    extractedName: extracted.name,
    fallbackName,
    primaryIdentifier,
    channel,
  });
  let created = false;
  if (!lead) {
    created = true;
    lead = await Lead.create({
      name: leadName,
      phone: channel === "WhatsApp" ? (primaryIdentifier || extracted.phone) : (extracted.phone || null),
      email: extracted.email,
      source,
      stage: "new",
      score: 0,
      notes: ensureChannelMarker(null, channel, primaryIdentifier),
      last_message: messageText || null,
      assigned_to: tenantId || null,
      created_by: tenantId || null,
      tenant_id: null,
      is_active: true,
    });
  }

  const existingConversation = lead?.id
    ? await Conversation.findOne({
        where: { lead_id: lead.id, is_deleted: false },
        order: [["updated_at", "DESC"]],
        attributes: ["intent"],
      })
    : null;

  const multilingualClassification = await classifyLeadIntent({
    tenantId,
    text: messageText,
    currentStage: lead.stage || "new",
    currentScore: lead.score || 0,
    fallbackIntent: intent,
    conversationHistory,
  });
  const resolvedIntent = getPinnedIntent(
    currentIntent || existingConversation?.intent || "unknown",
    multilingualClassification.intent || intent
  );
  // AI signals take full precedence over English-only regex signals so that
  // non-English conversations score correctly. The only regex-derived values
  // kept are those the AI doesn't classify: hasAttachments, hasSharedContactDetails,
  // and wordCount (all language-neutral).
  const mergedSignals = {
    ...signals,
    ...multilingualClassification.signals,
  };

  let dirty = false;

  const nextName = resolveLeadName({
    currentName: lead.name,
    extractedName: extracted.name,
    fallbackName,
    primaryIdentifier,
    channel,
  });
  if (nextName && lead.name !== nextName) {
    lead.name = nextName;
    dirty = true;
  }

  const nextNotes = ensureChannelMarker(lead.notes, channel, primaryIdentifier);
  if (lead.notes !== nextNotes) {
    lead.notes = nextNotes;
    dirty = true;
  }

  if (extracted.email && (!lead.email || lead.email !== extracted.email)) {
    lead.email = extracted.email;
    dirty = true;
  }

  if (extracted.phone) {
    const currentRecipientId = resolveChannelRecipientId(lead, channel);
    const canReplacePhone =
      !lead.phone ||
      lead.phone === primaryIdentifier ||
      lead.phone === currentRecipientId;

    if (canReplacePhone && lead.phone !== extracted.phone) {
      lead.phone = extracted.phone;
      dirty = true;
    }
  }

  if (!lead.source || lead.source !== source) {
    lead.source = source;
    dirty = true;
  }

  if (messageText && lead.last_message !== messageText) {
    lead.last_message = messageText;
    dirty = true;
  }

  if (!lead.assigned_to && tenantId) {
    lead.assigned_to = tenantId;
    dirty = true;
  }

  if (!lead.created_by && tenantId) {
    lead.created_by = tenantId;
    dirty = true;
  }

  const aiSuggestedStage = multilingualClassification.recommended?.stage || lead.stage || "new";
  const aiSuggestedScore = multilingualClassification.recommended?.score ?? lead.score ?? 0;
  const deterministicProgression = getDeterministicStageAndScore({
    currentStage: lead.stage || "new",
    currentScore: lead.score || 0,
    signals: mergedSignals,
    isFirstInboundMessage: created,
  });
  const guardedStage =
    (STAGE_RANK[aiSuggestedStage] ?? 0) > (STAGE_RANK[deterministicProgression.stage] ?? 0)
      ? aiSuggestedStage
      : deterministicProgression.stage;
  const nextScore = Math.max(
    deterministicProgression.score,
    aiSuggestedStage === guardedStage ? aiSuggestedScore : 0,
    STAGE_FLOOR[guardedStage] ?? 0
  );
  const stageChanged = lead.stage !== guardedStage;
  const scoreChanged = lead.score !== nextScore;

  if (scoreChanged) {
    lead.score = nextScore;
    dirty = true;
  }
  if (stageChanged) {
    lead.stage = guardedStage;
    dirty = true;
  }

  if (reopened) {
    dirty = true;
  }

  if (dirty) {
    await lead.save();
  }

  // Only regenerate summary when stage or score actually changes — not on
  // every message or every intent update, which was generating too many summaries.
  const shouldRefreshSummary = stageChanged || scoreChanged || created;

  if (shouldRefreshSummary) {
    triggerLeadSummary(lead.id, lead.created_by || lead.assigned_to, { intent: resolvedIntent });
  }

  return { lead, created, reopened, extracted, resolvedIntent };
};

const enforceLeadScoreStageConsistency = async (lead) => {
  if (!lead) return lead;

  // Only enforce the floor â€” don't overwrite a dynamically computed score downward
  const floor = STAGE_FLOOR[lead.stage || "new"] ?? 0;
  if ((lead.score || 0) < floor) {
    lead.score = floor;
    await lead.save();
  }

  return lead;
};

module.exports = {
  buildChannelMarker,
  enforceLeadScoreStageConsistency,
  ensureLeadChannelIdentity,
  extractChannelRecipientIdFromNotes,
  getPinnedIntent,
  resolveChannelRecipientId,
  upsertInboundLeadFromMessage,
};
