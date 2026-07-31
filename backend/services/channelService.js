const log = require("../utils/logger");
const { InstagramSession } = require("../models");

const MODULE = "ChannelService";

/**
 * Channel-agnostic outbound messaging layer.
 *
 * WhatsApp goes through the self-hosted Baileys/QR session. Instagram goes
 * through Meta's Instagram Graph API using each tenant's OWN Meta App
 * credentials and access token (no shared/global Meta App — see
 * instagramDmBootstrap.js/instagramMetaRoutes.js) — every caller already
 * routes through these functions, so no caller-side changes are needed when
 * a channel's underlying transport changes.
 */

class ChannelNotConnectedError extends Error {
  constructor(channel) {
    super(`Channel "${channel}" is not connected — outbound messaging is not implemented yet.`);
    this.name = "ChannelNotConnectedError";
    this.code = "CHANNEL_NOT_IMPLEMENTED";
    this.channel = channel;
  }
}

/**
 * Send a plain text message on a channel.
 * @param {"WhatsApp"|"Instagram"} channel
 * @param {object} setting     - tenant AISetting row (holds channel config)
 * @param {string} recipientId - phone (WhatsApp) or IGSID (Instagram)
 * @param {string} text        - message body
 * @param {object} [opts]      - { conversation } — when supplied for WhatsApp,
 *                               replies go out the conversation's linked number
 *                               (slot) and to its LID-safe JID.
 * @returns {Promise<object>}
 */
const sendOutbound = async (channel, setting, recipientId, text, opts = {}) => {
  if (channel === "WhatsApp") {
    // WhatsApp goes through the QR-linked session. Lazy require avoids a
    // circular dependency at module load time.
    const { sendWhatsAppText, slotForConversation } = require("./whatsappQrBootstrap");
    const conversation = opts.conversation || null;
    const tenantId = conversation?.tenant_id || setting?.tenant_id;
    // Prefer the LID-safe inbound JID; fall back to the bare recipient id.
    const target = conversation?.channel_thread_id || recipientId;
    const slot = conversation ? slotForConversation(conversation) : 1;
    return sendWhatsAppText(tenantId, target, text, slot);
  }

  if (channel === "Instagram") {
    // Instagram goes through Meta's Graph API using the tenant's OWN stored
    // access token (no shared/global app). Lazy require avoids a circular
    // dependency at module load time (same pattern as WhatsApp).
    const { sendInstagramText, slotForConversation } = require("./instagramDmBootstrap");
    const conversation = opts.conversation || null;
    const tenantId = conversation?.tenant_id || setting?.tenant_id;
    // Prefer the IG thread id captured on inbound; fall back to the bare recipient id.
    const target = conversation?.channel_thread_id || recipientId;
    const slot = conversation ? slotForConversation(conversation) : 1;
    return sendInstagramText(tenantId, target, text, slot);
  }

  // Any other channel has no live transport here yet.
  log.warn(MODULE, "sendOutbound", {
    channel,
    recipientId,
    note: "No transport configured — message not delivered.",
  });
  throw new ChannelNotConnectedError(channel);
};

/**
 * Send a template / structured message on a channel (used for campaign
 * re-engagement outside a free-form messaging window).
 * @param {"WhatsApp"|"Instagram"} channel
 * @param {object} setting
 * @param {string} recipientId
 * @param {object} template    - { name, languageCode, components } or plain { text }
 * @returns {Promise<object>}
 */
const sendOutboundTemplate = async (channel, setting, recipientId, template) => {
  log.warn(MODULE, "sendOutboundTemplate", {
    channel,
    recipientId,
    note: "No transport configured — template not delivered.",
  });
  throw new ChannelNotConnectedError(channel);
};

/**
 * Whether a channel is connected/usable for the given tenant setting.
 * WhatsApp is driven purely by the channel toggle. Instagram additionally
 * requires a connected InstagramSession row with the tenant's own stored
 * access token. `token_expires_at` is best-effort only (many clinic-supplied
 * long-lived tokens don't cleanly self-report an expiry) — connectivity is
 * gated on `status` (flipped to "token_expired" by the health-check job or a
 * failed send, see instagramDmBootstrap.js), not on this timestamp.
 * @param {"WhatsApp"|"Instagram"} channel
 * @param {object} setting
 * @returns {boolean}
 */
const isChannelConnected = async (channel, setting) => {
  if (!setting) return false;
  if (channel === "WhatsApp") return !!setting.whatsapp_enabled;
  if (channel === "Instagram") {
    if (!setting.instagram_enabled) return false;
    const live = await InstagramSession.findOne({
      where: {
        tenant_id: setting.tenant_id,
        status: "connected",
      },
    });
    return !!live;
  }
  return false;
};

module.exports = {
  sendOutbound,
  sendOutboundTemplate,
  isChannelConnected,
  ChannelNotConnectedError,
};
