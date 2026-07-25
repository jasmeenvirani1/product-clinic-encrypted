const { Op } = require("sequelize");
const { PlatformAISetting, User, Role, AISetting } = require("../models");

// Default self-chat prompt for the WhatsApp-QR "Message Yourself" thread.
// Overridable by super admin via PlatformAISetting.self_chat_prompt.
const DEFAULT_SELF_CHAT_PROMPT = `You are the clinic's internal WhatsApp assistant, talking to a staff member in their own "Message Yourself" chat.

This is NOT a patient. Do not run the patient booking/sales flow. Instead, act as a quick internal helper for the clinic staff:
- Be concise and direct.
- If the message looks like a note or reminder, acknowledge it briefly.
- If asked a question, answer helpfully as an internal assistant.
- Never ask for name/phone/booking details the way the patient flow does.

CONTROL COMMANDS: Staff can manage how a patient chat is handled by messaging here. For a specific phone number, they may ask to:
- pause / stop / turn off the AI, or hand the chat to a human ("switch to human mode for this number"),
- resume / enable / turn the AI back on ("switch to AI mode for this number").
The system executes these automatically and confirms back. Staff may phrase them in ANY language and with any wording — e.g. "pause AI for 9779...", "switch to human for 9876543210", "turn the bot back on for 91...". If such a request has no phone number, ask which number it applies to.

LANGUAGE: Detect the language the staff member is writing in and ALWAYS reply in that SAME language. If they write in another language, mirror it and answer in that language. Never force English when the staff wrote in a different language.`;

// Lightweight in-memory cache so the AI hot-path (every webhook /
// chat turn) does not hit the DB on every call. The platform prompt
// is updated only by super admin via the AI Settings page, so a
// short TTL is plenty — invalidation is implicit.
let cache = { value: null, fetchedAt: 0 };
let saCredCache = { value: null, fetchedAt: 0 };
const TTL_MS = 60 * 1000; // 1 minute

const loadSetting = async () => {
  const [setting] = await PlatformAISetting.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1 },
  });
  return setting;
};

const getPlatformDefaults = async () => {
  const now = Date.now();
  if (cache.value && now - cache.fetchedAt < TTL_MS) return cache.value;
  const setting = await loadSetting();
  cache = { value: setting, fetchedAt: now };
  return setting;
};

const getPlatformPromptInstructions = async () => {
  try {
    const setting = await getPlatformDefaults();
    return setting?.default_prompt_instructions || "";
  } catch {
    return "";
  }
};

const getPlatformUseCases = async () => {
  try {
    const setting = await getPlatformDefaults();
    return Array.isArray(setting?.use_cases) ? setting.use_cases : [];
  } catch {
    return [];
  }
};

// Build the use-cases block injected into every system prompt.
// Each entry: { title, example_question, correct_answer }
const buildUseCasesBlock = (useCases) => {
  if (!useCases || useCases.length === 0) return "";
  const lines = useCases
    .filter((uc) => uc && (uc.example_question || uc.correct_answer))
    .map((uc, i) => {
      const parts = [`${i + 1}. ${uc.title || "Use Case"}`];
      if (uc.example_question) parts.push(`   Q: ${uc.example_question}`);
      if (uc.correct_answer)   parts.push(`   A: ${uc.correct_answer}`);
      return parts.join("\n");
    });
  if (lines.length === 0) return "";
  return `\n\nUSE CASE EXAMPLES — follow these when similar questions arise:\n${lines.join("\n\n")}`;
};

// Raw platform OpenAI key — used only server-side for pre-auth / registration
// AI (e.g. logo → theme colour). Never expose this to the client.
const getPlatformOpenAIKey = async () => {
  try {
    const setting = await getPlatformDefaults();
    return setting?.platform_openai_api_key || null;
  } catch {
    return null;
  }
};

const getPlatformModel = async () => {
  try {
    const setting = await getPlatformDefaults();
    return setting?.default_openai_model || "gpt-4o-mini";
  } catch {
    return "gpt-4o-mini";
  }
};

// OpenAI-compatible base URL for platform AI (null → default OpenAI API).
const getPlatformBaseURL = async () => {
  try {
    const setting = await getPlatformDefaults();
    return setting?.default_openai_base_url || null;
  } catch {
    return null;
  }
};

// Self-chat prompt for the WhatsApp-QR "Message Yourself" thread. Falls back to
// the code-level default when the super admin hasn't set one.
const getSelfChatPrompt = async () => {
  try {
    const setting = await getPlatformDefaults();
    return setting?.self_chat_prompt || DEFAULT_SELF_CHAT_PROMPT;
  } catch {
    return DEFAULT_SELF_CHAT_PROMPT;
  }
};

// Resolve the platform/super-admin OpenAI credentials — used as a fallback when
// a tenant has no key of their own (so platform-key tenants still get AI
// replies, self-chat command classification, etc.). Cached briefly.
const getSuperAdminAICredentials = async () => {
  const now = Date.now();
  if (saCredCache.value && now - saCredCache.fetchedAt < TTL_MS) return saCredCache.value;

  let creds = { apiKey: null, model: null };
  try {
    const admins = await User.findAll({
      attributes: ["id"],
      where: { is_deleted: false },
      include: [{ model: Role, where: { name: "super_admin" }, attributes: [] }],
    });
    const ids = admins.map((u) => u.id);
    if (ids.length) {
      const sa = await AISetting.findOne({
        where: { tenant_id: { [Op.in]: ids }, openai_api_key: { [Op.ne]: null } },
      });
      if (sa?.openai_api_key) {
        creds = { apiKey: sa.openai_api_key, model: sa.openai_model || null };
      }
    }
  } catch {
    // fall through with empty creds
  }
  saCredCache = { value: creds, fetchedAt: now };
  return creds;
};

const invalidatePlatformAICache = () => {
  cache = { value: null, fetchedAt: 0 };
  saCredCache = { value: null, fetchedAt: 0 };
};

module.exports = {
  getPlatformDefaults,
  getPlatformPromptInstructions,
  getPlatformUseCases,
  getPlatformOpenAIKey,
  getPlatformModel,
  getPlatformBaseURL,
  buildUseCasesBlock,
  getSelfChatPrompt,
  getSuperAdminAICredentials,
  DEFAULT_SELF_CHAT_PROMPT,
  invalidatePlatformAICache,
};
