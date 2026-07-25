const { Op } = require("sequelize");
const { createOpenAI } = require("../utils/openaiClient");
const { Conversation, Message, Lead, AISetting } = require("../models");
const { sendOutbound } = require("./channelService");
const { resolveChannelRecipientId } = require("./leadAutomation");
const log = require("../utils/logger");

const MODULE = "FollowupService";

const getEffectiveLastPatientMessageAt = async (conversation) => {
  if (conversation.last_patient_message_at) {
    return new Date(conversation.last_patient_message_at);
  }

  const lastPatientMessage = await Message.findOne({
    where: {
      conversation_id: conversation.id,
      sender_type: "patient",
    },
    order: [["created_at", "DESC"]],
    attributes: ["created_at"],
  });

  const effectiveAt = lastPatientMessage?.get?.("created_at") || lastPatientMessage?.created_at || null;
  if (effectiveAt) {
    conversation.last_patient_message_at = effectiveAt;
    await conversation.save();
    return new Date(effectiveAt);
  }

  return null;
};

const generateFollowupMessage = async ({ setting, conversationHistory, followupNumber, leadName }) => {
  if (!setting.openai_api_key) {
    const name = leadName && !leadName.startsWith("+") ? leadName : "there";
    return followupNumber === 1
      ? `Hi ${name}, we noticed you haven't had a chance to reply. We're here whenever you're ready — feel free to ask us anything!`
      : `Hi ${name}, just a gentle reminder that our team is available to help. Don't hesitate to reach out!`;
  }

  try {
    const openai = createOpenAI(setting.openai_api_key, setting.openai_base_url);

    const historyLines = conversationHistory
      .slice(-8)
      .filter((m) => m.text)
      .map((m) => {
        const role = m.sender_type === "patient" ? "Patient" : "Clinic";
        return `${role}: ${m.text}`;
      })
      .join("\n");

    const ordinal = followupNumber === 1 ? "first" : "second";
    const prompt = `You are a follow-up assistant for a medical clinic. The patient hasn't replied to the clinic's messages.

Patient name: ${leadName || "Unknown"}
Previous conversation:
${historyLines || "(no messages yet)"}

Write a ${ordinal} follow-up message to re-engage this patient. Rules:
- Warm, empathetic, non-pushy tone
- Reference the conversation topic if relevant (e.g. the procedure or question they asked about)
- 2–3 sentences maximum
- No markdown or bullet points
- End with a soft open question or invitation to reply`;

    const completion = await openai.chat.completions.create({
      model: setting.openai_model || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.75,
    });

    return (
      completion.choices[0]?.message?.content?.trim() ||
      `Hi ${leadName || "there"}, just checking in — we're here to help whenever you're ready!`
    );
  } catch (err) {
    log.error(MODULE, "generateFollowupMessage", { error: err.message });
    return `Hi ${leadName || "there"}, we wanted to follow up on your enquiry. Our team is happy to assist — feel free to reply anytime!`;
  }
};

const sendFollowup = async (conversation, setting, followupNumber) => {
  try {
    const lead = conversation.Lead;
    if (!lead) return;

    const recipientId = resolveChannelRecipientId(lead, conversation.channel);
    if (!recipientId) {
      log.warn(MODULE, "sendFollowup", { message: "No recipient ID", conversationId: conversation.id });
      return;
    }

    const history = await Message.findAll({
      where: { conversation_id: conversation.id },
      order: [["created_at", "ASC"]],
      limit: 10,
      attributes: ["sender_type", "text"],
    });

    const followupText = await generateFollowupMessage({
      setting,
      conversationHistory: history,
      followupNumber,
      leadName: lead.name,
    });

    let sent = false;
    if (recipientId && (conversation.channel === "WhatsApp" || conversation.channel === "Instagram")) {
      try {
        await sendOutbound(conversation.channel, setting, recipientId, followupText);
        sent = true;
      } catch (err) {
        log.warn(MODULE, "sendFollowup:notSent", { channel: conversation.channel, error: err.message });
      }
    }

    if (sent) {
      await Message.create({
        conversation_id: conversation.id,
        sender_type: "ai",
        sender_id: null,
        receiver_id: null,
        receiver_type: "patient",
        text: followupText,
        metadata: { auto_followup: true, followup_number: followupNumber },
      });

      if (followupNumber === 1) {
        conversation.followup_1_sent_at = new Date();
      } else {
        conversation.followup_2_sent_at = new Date();
      }
      conversation.last_message_at = new Date();
      await conversation.save();

      log.info(MODULE, "sendFollowup", {
        conversationId: conversation.id,
        followupNumber,
        channel: conversation.channel,
        leadId: lead.id,
      });
    }
  } catch (err) {
    log.error(MODULE, "sendFollowup", {
      error: err.message,
      conversationId: conversation.id,
      followupNumber,
    });
  }
};

const processFollowups = async () => {
  try {
    const settings = await AISetting.findAll({
      where: {
        [Op.or]: [{ followup_1_enabled: true }, { followup_2_enabled: true }],
      },
    });

    if (!settings.length) return;

    const now = new Date();

    for (const setting of settings) {
      const tenantId = setting.tenant_id;

      // ── Follow-up 1: sent when patient has been silent for followup_1_days ──
      if (setting.followup_1_enabled && setting.followup_1_days > 0) {
        const cutoff1 = new Date(now - setting.followup_1_days * 24 * 60 * 60 * 1000);

        const eligible1 = await Conversation.findAll({
          where: {
            tenant_id: tenantId,
            is_deleted: false,
            status: { [Op.in]: ["open", "pending"] },
            channel: { [Op.in]: ["WhatsApp", "Instagram"] },
            followup_1_sent_at: null,
          },
          include: [
            {
              model: Lead,
              where: { is_deleted: false, stage: { [Op.notIn]: ["lost", "won"] } },
            },
          ],
        });

        for (const conv of eligible1) {
          const effectiveLastPatientMessageAt = await getEffectiveLastPatientMessageAt(conv);
          if (effectiveLastPatientMessageAt && effectiveLastPatientMessageAt <= cutoff1) {
            await sendFollowup(conv, setting, 1);
          }
        }
      }

      // ── Follow-up 2: sent followup_2_days after follow-up 1, if still no patient reply ──
      if (setting.followup_2_enabled && setting.followup_2_days > 0) {
        const cutoff2 = new Date(now - setting.followup_2_days * 24 * 60 * 60 * 1000);

        const eligible2Raw = await Conversation.findAll({
          where: {
            tenant_id: tenantId,
            is_deleted: false,
            status: { [Op.in]: ["open", "pending"] },
            channel: { [Op.in]: ["WhatsApp", "Instagram"] },
            followup_1_sent_at: { [Op.ne]: null, [Op.lte]: cutoff2 },
            followup_2_sent_at: null,
          },
          include: [
            {
              model: Lead,
              where: { is_deleted: false, stage: { [Op.notIn]: ["lost", "won"] } },
            },
          ],
        });

        // Only send follow-up 2 if patient hasn't replied since follow-up 1 was sent
        const eligible2 = [];
        for (const conv of eligible2Raw) {
          const effectiveLastPatientMessageAt = await getEffectiveLastPatientMessageAt(conv);
          if (
            !effectiveLastPatientMessageAt ||
            effectiveLastPatientMessageAt <= new Date(conv.followup_1_sent_at)
          ) {
            eligible2.push(conv);
          }
        }

        for (const conv of eligible2) {
          await sendFollowup(conv, setting, 2);
        }
      }
    }
  } catch (err) {
    log.error(MODULE, "processFollowups", { error: err.message });
  }
};

module.exports = { processFollowups };
