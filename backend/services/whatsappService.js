// ⚠️ Meta WhatsApp Business Cloud API integration removed.
//
// The Graph API (graph.facebook.com) send logic that used to live here has
// been stripped as part of the connection-flow change. Outbound WhatsApp
// messaging now goes through the channel-agnostic transport in
// ./channelService.js.
//
// These thin shims remain only so any not-yet-migrated caller still resolves.
// Prefer importing { sendOutbound } from "./channelService" directly.
const { sendOutbound, sendOutboundTemplate } = require("./channelService");

const sendTextMessage = async (_phoneNumberId, _accessToken, toPhone, text) =>
  sendOutbound("WhatsApp", null, toPhone, text);

const sendTemplateMessage = async (
  _phoneNumberId,
  _accessToken,
  toPhone,
  templateName,
  languageCode = "en_US",
  components = []
) =>
  sendOutboundTemplate("WhatsApp", null, toPhone, { name: templateName, languageCode, components });

module.exports = { sendTextMessage, sendTemplateMessage };
