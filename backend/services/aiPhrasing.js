const { createOpenAI } = require("../utils/openaiClient");
const log = require("../utils/logger");
const { getPlatformPromptInstructions } = require("../utils/platformAISettings");

const MODULE = "AIPhrasing";

const TONE_MAP = {
  professional: "Respond in a professional, clear, and confident tone.",
  warm: "Respond in a warm, caring, and empathetic tone.",
  premium: "Respond in a premium, sophisticated, and exclusive tone.",
  friendly: "Respond in a friendly, casual, and approachable tone.",
  formal: "Respond in a formal, respectful, and structured tone.",
};

// Rewrite a canned knowledge-base / FAQ answer in the tenant's configured
// tone + platform system prompt, so patients don't receive identical
// copy-pasted responses. Falls back to the raw answer if OpenAI is
// unavailable or the rewrite fails.
const rephraseFAQAnswer = async ({ patientText, faqAnswer, intent, aiSettings }) => {
  if (!faqAnswer) return faqAnswer;
  if (!aiSettings?.openai_api_key) return faqAnswer;

  try {
    const toneInstruction = TONE_MAP[aiSettings.ai_tone] || TONE_MAP.professional;
    const platformPrompt = await getPlatformPromptInstructions();

    const systemPrompt = `You are an AI assistant for a medical clinic. ${toneInstruction}
${platformPrompt}

You will be given the patient's message and an approved knowledge-base answer.
Rewrite the approved answer so it directly addresses the patient, matches the tone above, and feels natural — never copy it verbatim.
Rules:
- Preserve every fact, number, name, and link from the approved answer. Do not invent new information.
- Keep it concise (2-4 sentences). Do not use markdown.
- The patient's intent level is: ${intent}.`;

    const userPrompt = `Patient message: "${patientText || ""}"

Approved knowledge-base answer:
"""
${faqAnswer}
"""

Rewrite the approved answer for this patient now.`;

    const openai = createOpenAI(aiSettings.openai_api_key, aiSettings.openai_base_url);
    const completion = await openai.chat.completions.create({
      model: aiSettings.openai_model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.6,
    });

    const reply = completion.choices[0]?.message?.content;
    return reply ? reply.trim() : faqAnswer;
  } catch (err) {
    log.error(MODULE, "rephraseFAQAnswer", { error: err.message });
    return faqAnswer;
  }
};

module.exports = { rephraseFAQAnswer };
