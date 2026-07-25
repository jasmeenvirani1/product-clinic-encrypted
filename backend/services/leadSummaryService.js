const { createOpenAI } = require("../utils/openaiClient");
const { Lead, Conversation, Message, AISetting, LeadSummary } = require("../models");
const log = require("../utils/logger");

const MODULE = "LeadSummaryService";

const generateLeadSummary = async (leadId, tenantId, { intent } = {}) => {
  try {
    const lead = await Lead.findByPk(leadId);
    if (!lead) return;

    const setting = await AISetting.findOne({ where: { tenant_id: tenantId } });
    if (!setting?.openai_api_key) {
      log.warn(MODULE, "generateLeadSummary", { leadId, message: "No OpenAI API key configured" });
      return;
    }

    // Fetch the most recent conversation + last 20 messages
    const conversation = await Conversation.findOne({
      where: { lead_id: leadId },
      order: [["updated_at", "DESC"]],
    });

    let messageLines = "";
    const resolvedIntent = intent || conversation?.intent || "unknown";

    if (conversation) {
      const messages = await Message.findAll({
        where: { conversation_id: conversation.id },
        order: [["created_at", "ASC"]],
        limit: 20,
      });

      messageLines = messages
        .filter((m) => m.text)
        .map((m) => {
          const role = m.sender_type === "patient" ? "Patient" : "Clinic";
          return `${role}: ${m.text}`;
        })
        .join("\n");
    }

    const prompt = `You are a CRM assistant for a medical clinic. Summarize this lead in 2–3 concise sentences covering: what the patient is enquiring about, their current intent level, and their stage in the sales funnel.

Lead details:
- Name: ${lead.name || "Unknown"}
- Source: ${lead.source || "Unknown"}
- Stage: ${lead.stage}
- Score: ${lead.score}
- City: ${lead.city || "Unknown"}
- Intent: ${resolvedIntent}

Recent conversation:
${messageLines || "(no messages yet)"}

Rules:
- 2–3 sentences maximum
- Plain text, no bullet points or markdown
- Professional and factual tone
- Mention the intent level and what triggered the score change if relevant`;

    const openai = createOpenAI(setting.openai_api_key, setting.openai_base_url);

    const completion = await openai.chat.completions.create({
      model: setting.openai_model || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 120,
      temperature: 0.4,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) return;

    // Save as a history entry
    await LeadSummary.create({
      lead_id: leadId,
      summary,
      stage: lead.stage,
      score: lead.score,
      intent: resolvedIntent,
    });

    // Also keep the latest on the Lead for quick access
    lead.ai_summary = summary;
    lead.summary_updated_at = new Date();
    await lead.save();

    log.info(MODULE, "generateLeadSummary", { leadId, stage: lead.stage, score: lead.score });
  } catch (err) {
    log.error(MODULE, "generateLeadSummary", { leadId, error: err.message });
  }
};

// Fire-and-forget — call without awaiting from automation hooks
const triggerLeadSummary = (leadId, tenantId, options = {}) => {
  if (!leadId || !tenantId) return;
  setImmediate(() => void generateLeadSummary(leadId, tenantId, options));
};

module.exports = { generateLeadSummary, triggerLeadSummary };
