// Shared multilingual helpers for the WhatsApp/Instagram AI.
//
// The AI must ALWAYS answer in the patient's own language on every turn —
// including photo-only and voice turns that carry no language signal of their
// own. Previously this was patched ad-hoc inside generateAIResponse (only for
// photo-only turns), which let replies drift to English whenever the current
// turn had no clear text. Centralising it here keeps the behaviour identical
// across every caller and every turn type.

// Placeholders we inject for non-text turns — these are NOT a language signal.
const PLACEHOLDER_RE =
  /^\[(image|images|media|photo|photos|attachment|attachments|voice message|voice|audio|video|file)\]$/i;

/**
 * Find the patient's most recent REAL text in the conversation (skipping
 * "[image]"/"[media]" placeholders). Voice turns store their transcript in
 * metadata, so fall back to that. Returns "" when no sample exists.
 * @param {Array<{sender_type?:string,text?:string,metadata?:object,role?:string}>} conversationHistory
 * @param {number} maxLen
 * @returns {string}
 */
function getLastPatientLanguageSample(conversationHistory, maxLen = 200) {
  if (!Array.isArray(conversationHistory)) return "";
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const m = conversationHistory[i];
    if (!m) continue;
    const isPatient = m.sender_type === "patient" || m.role === "patient";
    if (!isPatient) continue;
    const raw =
      (m.text && String(m.text).trim()) ||
      (m.metadata && m.metadata.transcript) ||
      "";
    const t = String(raw).trim();
    if (t && !PLACEHOLDER_RE.test(t)) return t.slice(0, maxLen);
  }
  return "";
}

/**
 * Build the language directive appended to the system prompt. It applies to
 * EVERY turn (not just photo turns): mirror the patient's language and dialect,
 * never default to English.
 *
 * @param {object} opts
 * @param {string} [opts.currentText]     the patient's text on THIS turn (if any)
 * @param {string} [opts.languageSample]  most recent prior patient text (from getLastPatientLanguageSample)
 * @param {boolean} [opts.noCurrentText]  true when this turn is photo/voice-only with no caption
 * @returns {string} instruction block (leading blank line included), or "" if nothing to anchor on
 */
function buildLanguageInstruction({ currentText = "", languageSample = "", noCurrentText = false } = {}) {
  const current = String(currentText || "").trim();
  const sample = String(languageSample || "").trim();

  const base =
    `LANGUAGE — CRITICAL ON EVERY TURN: Detect the language AND dialect the patient is writing in and reply ONLY in that exact same language. ` +
    `Mirror their script (e.g. Arabic script, Devanagari, Latin) and regional dialect. ` +
    `NEVER switch to English (or any other language) unless the patient themselves switches. ` +
    `Do NOT translate, do NOT add an English version alongside your reply.`;

  if (noCurrentText) {
    // Photo/voice-only turn: nothing on this turn tells us the language, so
    // pin it to the last thing the patient actually wrote.
    const anchor = sample
      ? ` This turn has no patient text (photo/voice only). Photos and media have NO language, so do NOT default to English. The patient's language is EXACTLY that of this earlier message they sent — reply ONLY in that same language: "${sample}"`
      : ` This turn has no patient text (photo/voice only). Reply in the language of the patient's most recent text message in the conversation above — never default to English.`;
    return `\n\n${base}${anchor}`;
  }

  // Normal turn — the current text is the primary signal; the prior sample is a
  // tie-breaker for very short messages ("ok", "👍") that carry little signal.
  const anchor =
    !current || current.length <= 3
      ? sample
        ? ` The current message is very short; use the patient's earlier message as the language anchor: "${sample}"`
        : ""
      : "";
  return `\n\n${base}${anchor}`;
}

module.exports = {
  PLACEHOLDER_RE,
  getLastPatientLanguageSample,
  buildLanguageInstruction,
};
