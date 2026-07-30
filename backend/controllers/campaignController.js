const { Op } = require("sequelize");
const { Campaign, Conversation, Lead, User, AISetting } = require("../models");
const log = require("../utils/logger");
const { sendOutbound, sendOutboundTemplate, isChannelConnected } = require("../services/channelService");

const MODULE = "CampaignController";

// ─── Get lead IDs that have at least one conversation ───────────────
const getLeadIdsWithConversations = async (tenantId) => {
  const conversations = await Conversation.findAll({
    where: { tenant_id: tenantId, is_deleted: false },
    attributes: ["lead_id"],
    raw: true,
  });
  return [...new Set(conversations.map((c) => c.lead_id))];
};

// ─── Build audience query based on campaign audience type ───────────
const buildAudienceWhere = async (audience, audienceDays, tenantId) => {
  const where = { is_deleted: false };

  // Scope leads same way as leadController
  // tenant_admin has tenant_id=null, their leads also have tenant_id=null
  where.tenant_id = tenantId === null || tenantId === undefined ? null : tenantId;

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - audienceDays * 24 * 60 * 60 * 1000);

  switch (audience) {
    case "new_leads": {
      // Leads that do NOT have any existing conversation (fresh leads)
      const existingLeadIds = await getLeadIdsWithConversations(tenantId);
      if (existingLeadIds.length > 0) {
        where.id = { [Op.notIn]: existingLeadIds };
      }
      break;
    }
    case "old_leads": {
      // Leads that HAVE existing conversations (existing patients)
      const existingLeadIds = await getLeadIdsWithConversations(tenantId);
      if (existingLeadIds.length > 0) {
        where.id = { [Op.in]: existingLeadIds };
      } else {
        // No leads have conversations, return nothing
        where.id = 0;
      }
      break;
    }
    case "inactive_leads":
      // No activity in last X days AND stage is NOT won or lost
      where.updated_at = { [Op.lt]: cutoffDate };
      where.stage = { [Op.notIn]: ["won", "lost"] };
      break;
    case "won_leads":
      where.stage = "won";
      break;
    case "lost_leads":
      where.stage = "lost";
      break;
    case "all":
    default:
      // All leads
      break;
  }

  return where;
};

// ─── Get all campaigns ──────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantId = req.user.tenant_id || req.user.id;
    const where = { is_deleted: false };

    if (role !== "super_admin") {
      where.tenant_id = tenantId;
    }

    const campaigns = await Campaign.findAll({
      where,
      include: [
        { model: User, as: "CreatedByUser", attributes: ["id", "full_name", "email"] },
      ],
      order: [["id", "DESC"]],
    });

    log.info(MODULE, "getAll", { userId: req.user.id, resultCount: campaigns.length });
    return res.status(200).json({ success: true, data: campaigns });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get by ID ──────────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      where: { id: req.params.id, is_deleted: false },
      include: [
        { model: User, as: "CreatedByUser", attributes: ["id", "full_name", "email"] },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    return res.status(200).json({ success: true, data: campaign });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Create campaign ────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      name, offer_type, offer_description, message_template,
      channel, audience, audience_days, budget, status,
      whatsapp_template_name, whatsapp_template_language, custom_data,
    } = req.body;
    const tenantId = req.user.tenant_id || req.user.id;
    const leadTenantId = req.user.tenant_id; // matches how leads are stored

    if (!name || !channel) {
      return res.status(400).json({ success: false, message: "name and channel are required." });
    }

    // Count matching audience
    const audienceWhere = await buildAudienceWhere(audience || "all", audience_days || 30, leadTenantId);
    const totalRecipients = await Lead.count({ where: audienceWhere });

    const campaign = await Campaign.create({
      name: name.trim(),
      offer_type: offer_type || "custom",
      offer_description: offer_description || null,
      message_template: message_template || null,
      channel,
      audience: audience || "all",
      audience_days: audience_days || 30,
      budget: budget || null,
      status: status || "draft",
      total_recipients: totalRecipients,
      whatsapp_template_name: whatsapp_template_name || null,
      whatsapp_template_language: whatsapp_template_language || "en",
      tenant_id: tenantId,
      created_by: req.user.id,
      custom_data: (custom_data && typeof custom_data === "object") ? custom_data : {},
    });

    const created = await Campaign.findByPk(campaign.id, {
      include: [{ model: User, as: "CreatedByUser", attributes: ["id", "full_name", "email"] }],
    });

    log.info(MODULE, "create", { userId: req.user.id, campaignId: created.id, totalRecipients });
    return res.status(201).json({ success: true, message: "Campaign created.", data: created });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update campaign ────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    const {
      name, offer_type, offer_description, message_template,
      channel, audience, audience_days, budget, status,
      whatsapp_template_name, whatsapp_template_language, custom_data,
    } = req.body;

    if (name !== undefined) campaign.name = name.trim();
    if (offer_type !== undefined) campaign.offer_type = offer_type;
    if (offer_description !== undefined) campaign.offer_description = offer_description;
    if (message_template !== undefined) campaign.message_template = message_template;
    if (channel !== undefined) campaign.channel = channel;
    if (audience !== undefined) campaign.audience = audience;
    if (audience_days !== undefined) campaign.audience_days = audience_days;
    if (budget !== undefined) campaign.budget = budget;
    if (status !== undefined) campaign.status = status;
    if (whatsapp_template_name !== undefined) campaign.whatsapp_template_name = whatsapp_template_name;
    if (whatsapp_template_language !== undefined) campaign.whatsapp_template_language = whatsapp_template_language;
    if (custom_data !== undefined && typeof custom_data === "object") {
      campaign.custom_data = { ...(campaign.custom_data ?? {}), ...custom_data };
    }

    // Recalculate recipients if audience changed
    if (audience !== undefined || audience_days !== undefined) {
      const leadTenantId = req.user.tenant_id;
      const audienceWhere = await buildAudienceWhere(
        audience || campaign.audience,
        audience_days || campaign.audience_days,
        leadTenantId
      );
      campaign.total_recipients = await Lead.count({ where: audienceWhere });
    }

    await campaign.save();

    const updated = await Campaign.findByPk(campaign.id, {
      include: [{ model: User, as: "CreatedByUser", attributes: ["id", "full_name", "email"] }],
    });

    log.info(MODULE, "update", { userId: req.user.id, campaignId: campaign.id });
    return res.status(200).json({ success: true, message: "Campaign updated.", data: updated });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Preview audience (see matching leads before sending) ───────────
exports.previewAudience = async (req, res) => {
  try {
    const { audience, audience_days } = req.query;
    const leadTenantId = req.user.tenant_id;

    const where = await buildAudienceWhere(audience || "all", parseInt(audience_days) || 30, leadTenantId);

    const leads = await Lead.findAll({
      where,
      attributes: ["id", "name", "phone", "email", "stage", "source", "created_at", "updated_at"],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    const total = await Lead.count({ where });

    return res.status(200).json({
      success: true,
      data: { total, leads },
    });
  } catch (err) {
    log.error(MODULE, "previewAudience", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Send campaign via WhatsApp / Instagram APIs ───────────────────
exports.send = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    if (!campaign.message_template && !campaign.whatsapp_template_name) {
      return res.status(400).json({ success: false, message: "Campaign has no message template or WhatsApp template name." });
    }

    const tenantId = req.user.tenant_id || req.user.id;
    const leadTenantId = req.user.tenant_id;

    // Load tenant channel credentials
    const aiSetting = await AISetting.findOne({ where: { tenant_id: tenantId } });

    // Validate the chosen channel is connected. The Meta integration was
    // removed — connection readiness now comes from channelService until the
    // new connection flow provides its own transport.
    if ((campaign.channel === "WhatsApp" || campaign.channel === "Instagram") &&
        !(await isChannelConnected(campaign.channel, aiSetting))) {
      return res.status(400).json({
        success: false,
        message: `${campaign.channel} is not connected. Please connect it in Settings → Channels.`,
      });
    }

    const where = await buildAudienceWhere(campaign.audience, campaign.audience_days, leadTenantId);

    const leads = await Lead.findAll({
      where,
      attributes: ["id", "name", "phone", "email"],
    });

    // Filter contactable leads by channel
    const contactable = leads.filter((l) => {
      if (campaign.channel === "WhatsApp") return !!l.phone;
      if (campaign.channel === "Instagram") return !!l.email; // email used as igsid placeholder until webhook maps it
      return !!l.phone || !!l.email;
    });

    let sentCount = 0;
    const errors = [];

    for (const lead of contactable) {
      try {
        const body = campaign.message_template.replace(/\{name\}/gi, lead.name || "there");
        if (campaign.channel === "WhatsApp") {
          if (campaign.whatsapp_template_name) {
            await sendOutboundTemplate("WhatsApp", aiSetting, lead.phone, {
              name: campaign.whatsapp_template_name,
              languageCode: campaign.whatsapp_template_language || "en",
              components: [],
            });
          } else {
            await sendOutbound("WhatsApp", aiSetting, lead.phone, body);
          }
        } else if (campaign.channel === "Instagram") {
          // igsid stored on the lead (phone field used as igsid for now)
          const recipientId = lead.phone || lead.email;
          await sendOutbound("Instagram", aiSetting, recipientId, body);
        }
        sentCount++;
      } catch (sendErr) {
        errors.push({ leadId: lead.id, error: sendErr.message });
        log.warn(MODULE, "send:leadError", { campaignId: campaign.id, leadId: lead.id, error: sendErr.message });
      }
    }

    campaign.sent_count = sentCount;
    campaign.total_recipients = leads.length;
    campaign.sent_at = new Date();
    campaign.status = "active";
    await campaign.save();

    log.info(MODULE, "send", {
      userId: req.user.id,
      campaignId: campaign.id,
      totalLeads: leads.length,
      contactable: contactable.length,
      sent: sentCount,
      errors: errors.length,
      channel: campaign.channel,
    });

    return res.status(200).json({
      success: true,
      message: `Campaign sent to ${sentCount} of ${leads.length} leads via ${campaign.channel}.`,
      data: {
        total_recipients: leads.length,
        contactable: contactable.length,
        sent_count: sentCount,
        failed_count: errors.length,
        channel: campaign.channel,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    log.error(MODULE, "send", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Delete campaign ────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    campaign.is_deleted = true;
    await campaign.save();

    log.info(MODULE, "remove", { userId: req.user.id, campaignId: campaign.id });
    return res.status(200).json({ success: true, message: "Campaign deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
