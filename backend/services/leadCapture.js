/**
 * High-intent lead-detail capture state machine.
 *
 * When a patient message is flagged as high intent we ask for the minimum
 * lead details (name, phone, email). The patient gets up to two prompts
 * (initial + one re-ask). If details are still missing after the second
 * prompt the conversation is "escalated": the lead is saved with whatever
 * we have and the tenant admin is emailed.
 *
 * This module is pure state-machine + extraction logic; it does NOT touch
 * the database or send emails. Callers (conversationController,
 * webhookController) are responsible for persisting the conversation /
 * lead and dispatching the escalation email.
 */

const EMAIL_RE = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
const PHONE_RE = /(\+?\d[\d\s\-()]{6,}\d)/;
const GLOBAL_NAME_TOKEN = String.raw`\p{L}[\p{L}\p{M}'’.\\-]*`;
const NAME_PATTERNS = [
  new RegExp(`\\b(?:my\\s*name\\s*is|i\\s*am|i['â€™]m|this\\s*is|name\\s*[:\\-]\\s*|call\\s*me)\\s+(${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,3})`, "iu"),
  new RegExp(`\\b(?:it's|it is)\\s+(${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,3})\\b`, "iu"),
  new RegExp(`\\b(?:you can call me|reach me as)\\s+(${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,3})`, "iu"),
];
const SHORT_NAME_RE = new RegExp(`^${GLOBAL_NAME_TOKEN}(?:\\s+${GLOBAL_NAME_TOKEN}){0,2}$`, "iu");

const MAX_ATTEMPTS = 2; // initial ask + 1 re-ask

function extractDetails(text) {
  const out = {};
  if (!text) return out;

  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch) out.email = emailMatch[1].trim();

  const phoneMatch = text.match(PHONE_RE);
  if (phoneMatch) {
    const cleaned = phoneMatch[1].replace(/[^\d+]/g, "");
    if (cleaned.replace(/\D/g, "").length >= 7) out.phone = cleaned;
  }

  let extractedName = null;
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim().replace(/\s+/g, " ");
    if (candidate && !/^(interested|looking|going|here|fine|good|ok)/i.test(candidate)) {
      extractedName = candidate;
      break;
    }
  }

  if (extractedName) {
    out.name = extractedName;
  } else {
    const cleaned = text.trim().replace(/\s+/g, " ");
    if (
      cleaned.length <= 40 &&
      !/@/.test(cleaned) &&
      !/\d/.test(cleaned) &&
      SHORT_NAME_RE.test(cleaned) &&
      !/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no)$/i.test(cleaned)
    ) {
      out.name = cleaned;
    }
  }

  return out;
}

function getMissingFields(collected) {
  const missing = [];
  if (!collected.name) missing.push("name");
  if (!collected.phone) missing.push("phone");
  if (!collected.email) missing.push("email");
  return missing;
}

function hasMinimum(collected) {
  return Boolean(collected.name && (collected.phone || collected.email));
}

function composePrompt(missing, attempt) {
  const lead =
    attempt <= 1
      ? "Glad you're interested! To get you booked, could you share"
      : "Thanks for your reply â€” I just need";
  const labelMap = { name: "your name", phone: "your phone number", email: "your email" };
  const list = missing.map((f) => labelMap[f] || f);
  let joined;
  if (list.length === 1) joined = list[0];
  else if (list.length === 2) joined = `${list[0]} and ${list[1]}`;
  else joined = `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
  return `${lead} ${joined}? Our team will reach out shortly after.`;
}

/**
 * Seed the collected map from whatever the lead row already has, so we
 * don't ask the patient for details we already know.
 */
function seedCollectedFromLead(stateCollected, lead) {
  const collected = { ...(stateCollected || {}) };
  if (lead) {
    if (
      !collected.name &&
      lead.name &&
      lead.name !== lead.phone &&
      !lead.name.startsWith("Instagram User")
    ) {
      collected.name = lead.name;
    }
    if (!collected.phone && lead.phone) collected.phone = lead.phone;
    if (!collected.email && lead.email) collected.email = lead.email;
  }
  return collected;
}

/**
 * Decide what the chatbot should do next, given the patient's latest
 * message and the conversation's current capture state.
 *
 * @returns {Object|null} { handled: boolean, replyText?: string,
 *   nextState: <new lead_capture_state>, leadPatch: { name?, phone?, email? },
 *   completed?: boolean, escalated?: boolean, missing?: string[] }
 *   `handled=true` means the caller should use replyText as the bot
 *   response and skip the regular AI reply path.
 */
function processHighIntentCapture({ conversation, lead, text, intent }) {
  const prevState = conversation.lead_capture_state || {
    phase: "idle",
    collected: {},
    attempts: 0,
  };

  // Once finished or escalated we don't re-enter for this conversation.
  if (prevState.phase === "completed" || prevState.phase === "escalated") {
    return { handled: false, nextState: prevState };
  }

  // Only engage on high intent â€” or if we're already mid-collection.
  if (intent !== "high" && prevState.phase !== "collecting") {
    return { handled: false, nextState: prevState };
  }

  // â”€â”€ Helper: build a confirmation message that clearly enumerates
  //    the patient details we will send to the tenant team.
  const confirmationText = (collected) => {
    const lines = [];
    if (collected.name)  lines.push(`Name: ${collected.name}`);
    if (collected.phone) lines.push(`Phone: ${collected.phone}`);
    if (collected.email) lines.push(`Email: ${collected.email}`);
    const summary = lines.length ? ` Sharing with our team â€” ${lines.join(", ")}.` : "";
    return `Thanks${collected.name ? ", " + collected.name : ""}!${summary} They'll reach out shortly to confirm your booking.`;
  };

  // â”€â”€ First trigger: patient just said something high intent â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (prevState.phase === "idle") {
    const collected = seedCollectedFromLead(prevState.collected, lead);
    const missing = getMissingFields(collected);

    // Even when the lead row already has every detail we still owe the
    // patient an acknowledgement â€” confirm the handoff explicitly,
    // mark the capture completed, and let the caller fire the
    // "new lead received" email. The generic AI reply must NOT run on
    // top of this, hence handled:true.
    if (missing.length === 0) {
      return {
        handled: true,
        replyText: confirmationText(collected),
        nextState: {
          ...prevState,
          phase: "completed",
          collected,
          attempts: 0,
          triggered_at: new Date().toISOString(),
        },
        completed: true,
        leadPatch: {},
      };
    }

    return {
      handled: true,
      replyText: composePrompt(missing, 1),
      nextState: {
        phase: "collecting",
        collected,
        attempts: 1,
        triggered_at: new Date().toISOString(),
      },
      missing,
      leadPatch: {},
    };
  }

  // â”€â”€ In collecting phase: extract from this reply â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const extracted = extractDetails(text);
  const collected = seedCollectedFromLead(
    { ...(prevState.collected || {}), ...extracted },
    lead
  );

  if (hasMinimum(collected)) {
    return {
      handled: true,
      replyText: confirmationText(collected),
      nextState: { ...prevState, phase: "completed", collected, attempts: prevState.attempts },
      completed: true,
      leadPatch: extracted,
    };
  }

  const missing = getMissingFields(collected);

  // We've already asked MAX_ATTEMPTS times and still don't have enough.
  if (prevState.attempts >= MAX_ATTEMPTS) {
    return {
      handled: true,
      replyText:
        "Thanks for your message! Our team will follow up with you directly using the details we have. Is there anything else I can help with?",
      nextState: {
        ...prevState,
        phase: "escalated",
        collected,
        attempts: prevState.attempts,
        escalated_at: new Date().toISOString(),
      },
      escalated: true,
      missing,
      leadPatch: extracted,
    };
  }

  // Otherwise re-ask for what's still missing.
  const nextAttempt = prevState.attempts + 1;
  return {
    handled: true,
    replyText: composePrompt(missing, nextAttempt),
    nextState: { ...prevState, phase: "collecting", collected, attempts: nextAttempt },
    missing,
    leadPatch: extracted,
  };
}

module.exports = {
  extractDetails,
  getMissingFields,
  hasMinimum,
  composePrompt,
  processHighIntentCapture,
  MAX_ATTEMPTS,
};
