const { resolveChannelRecipientId } = require("./leadAutomation");
const { sendDirectMessage } = require("./instagramService");
const { sendTextMessage } = require("./whatsappService");
const log = require("../utils/logger");

const MODULE = "ChannelDelivery";

/**
 * Deliver a plain-text message to the patient on the conversation's channel,
 * OUTSIDE the live inbound context (follow-ups, deferred callbacks) where we
 * don't have the original message JID.
 *
 * WhatsApp now goes through the QR-linked session (same transport as normal
 * replies). The Meta Cloud API is used only as a fallback for tenants still
 * configured with Cloud creds, so existing behaviour keeps working.
 *
 * @returns {Promise<boolean>} true when the message was sent.
 */
async function deliverText({ conversation, setting, lead, text }) {
  if (!text || !conversation) return false;
  const channel = conversation.channel;
  const recipientId = resolveChannelRecipientId(lead, channel);

  if (channel === "WhatsApp") {
    const tenantId = conversation.tenant_id || setting.tenant_id;
    // Prefer the exact JID the last inbound message arrived on (LID-safe). Modern
    // WhatsApp contacts are addressed by LID ("<id>@lid"); sending to
    // "<phone>@s.whatsapp.net" for such a contact goes to a non-existent
    // recipient — the message is saved but never delivered. Fall back to the
    // lead's phone / stored recipient id only when we have no inbound JID.
    const target =
      conversation.channel_thread_id ||
      (lead?.phone && /^\d{6,}$/.test(String(lead.phone)) ? String(lead.phone) : recipientId);
    if (!target) return false;
    try {
      // Lazy require avoids a circular dependency at module load time.
      const { sendWhatsAppText, slotForConversation } = require("./whatsappQrBootstrap");
      // Reply out the SAME linked number the chat is on (multi-number support).
      await sendWhatsAppText(tenantId, target, text, slotForConversation(conversation));
      return true;
    } catch (qrErr) {
      // QR session unavailable — fall back to Cloud API if this tenant has creds.
      if (setting.whatsapp_phone_number_id && setting.whatsapp_access_token && recipientId) {
        await sendTextMessage(
          setting.whatsapp_phone_number_id,
          setting.whatsapp_access_token,
          recipientId,
          text
        );
        return true;
      }
      log.warn(MODULE, "deliverText:whatsapp", { conversationId: conversation.id, error: qrErr.message });
      return false;
    }
  }

  if (channel === "Instagram") {
    if (setting.instagram_page_id && setting.instagram_access_token && recipientId) {
      await sendDirectMessage(
        setting.instagram_page_id,
        setting.instagram_access_token,
        recipientId,
        text
      );
      return true;
    }
    return false;
  }

  // Web Chat has no outbound push channel.
  return false;
}

module.exports = { deliverText };
