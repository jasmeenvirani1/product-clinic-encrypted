const log = require("../utils/logger");

const MODULE = "ChannelService";

/**
 * Channel-agnostic outbound messaging layer.
 *
 * The previous Meta Graph API integration (WhatsApp Cloud API / Instagram
 * Graph API) has been removed pending a NEW connection flow. These functions
 * are intentional stubs so the rest of the app (webhooks, conversations,
 * campaigns, follow-ups) keeps its pipeline intact while the new transport is
 * wired in.
 *
 * When the new flow is defined, implement the send logic here — every caller
 * already routes through these functions, so no caller-side changes are needed.
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

  // Instagram (and any other channel) has no live transport here yet.
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
 * With Meta removed, this is driven purely by the channel toggle until the
 * new connection flow sets its own readiness signal.
 * @param {"WhatsApp"|"Instagram"} channel
 * @param {object} setting
 * @returns {boolean}
 */
const isChannelConnected = (channel, setting) => {
  if (!setting) return false;
  if (channel === "WhatsApp") return !!setting.whatsapp_enabled;
  if (channel === "Instagram") return !!setting.instagram_enabled;
  return false;
};

module.exports = {
  sendOutbound,
  sendOutboundTemplate,
  isChannelConnected,
  ChannelNotConnectedError,
};
