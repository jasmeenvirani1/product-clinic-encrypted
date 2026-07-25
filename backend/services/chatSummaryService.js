const OpenAI = require("openai");
const { getSuperAdminAICredentials } = require("../utils/platformAISettings");
const log = require("../utils/logger");

const MODULE = "ChatSummary";

// How many of the most recent messages are sent to the model verbatim. Everything
// OLDER than this is folded into conversation.chat_summary. Keep this in sync with
// the recent-window size used in generateAIResponse when a summary is present.
const KEEP_RECENT = 5;

// Tenant key first, then super-admin/platform key (same policy as the AI reply).
async function resolveOpenAIKey(setting) {
  let apiKey = setting?.openai_api_key || null;
  if (!apiKey) {
    const sa = await getSuperAdminAICredentials();
    if (sa?.apiKey) apiKey = sa.apiKey;
  }
  return apiKey;
}

const lineFor = (m) =>
  `${m.sender_type === "patient" ? "Patient" : "Loubna"}: ${
    (m.text && String(m.text).trim()) ||
    (m.metadata && m.metadata.transcript) ||
    "[media]"
  }`;

/**
 * Maintain a running summary of the conversation. Folds every message OLDER than
 * the last KEEP_RECENT into conversation.chat_summary (merged with the prior
 * summary), so collected facts survive after they leave the recent-message window.
 * Non-fatal: on any error the previous summary is returned unchanged.
 *
 * @param {object} p
 * @param {object} p.conversation  Sequelize Conversation instance (saved on update)
 * @param {Array}  p.fullHistory   messages in chronological order (sender_type, text, metadata)
 * @param {object} p.setting       AISetting (for the OpenAI key/model)
 * @returns {Promise<string>} the current summary ("" when none / not needed yet)
 */
async function updateChatSummary({ conversation, fullHistory, setting }) {
  try {
    if (!conversation || !Array.isArray(fullHistory) || fullHistory.length <= KEEP_RECENT) {
      return (conversation && conversation.chat_summary) || "";
    }
    const apiKey = await resolveOpenAIKey(setting);
    if (!apiKey) return conversation.chat_summary || "";

    const older = fullHistory.slice(0, -KEEP_RECENT);
    const prior = conversation.chat_summary || "(none yet)";
    // Cap the transcript so the summariser stays cheap even on very long chats.
    const transcript = older.map(lineFor).join("\n").slice(-6000);

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: setting?.openai_model || "gpt-4o",
      temperature: 0,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content:
            "You maintain a running memory summary of a hair-transplant clinic WhatsApp chat, " +
            "used so the assistant never forgets what was already collected. Output ONLY the updated " +
            "summary, under 120 words, factual, no greetings or commentary. " +
            "ALWAYS preserve these facts EXPLICITLY when they are known, each on its own line " +
            "(omit a line only if that fact is still unknown): " +
            "NAME, AGE, AREA, DURATION, TREATMENTS, PHOTOS_RECEIVED (yes/no), MEDICAL (their allergy/condition answer), " +
            "BOOKING_DATE, BOOKING_TIME, LANGUAGE. " +
            "Merge the new messages into the prior summary and NEVER drop a fact that was already known.",
        },
        {
          role: "user",
          content: `PRIOR SUMMARY:\n${prior}\n\nNEW OLDER MESSAGES TO FOLD IN:\n${transcript}`,
        },
      ],
    });

    const summary = completion.choices?.[0]?.message?.content?.trim();
    if (summary) {
      conversation.chat_summary = summary;
      await conversation.save();
    }
    return conversation.chat_summary || "";
  } catch (err) {
    log.warn(MODULE, "updateChatSummary", { error: err.message });
    return (conversation && conversation.chat_summary) || "";
  }
}

module.exports = { updateChatSummary, KEEP_RECENT };
