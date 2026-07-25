// ⚠️ Meta Instagram Graph API integration removed.
//
// The Graph API (graph.facebook.com) send/fetch logic that used to live here
// has been stripped as part of the connection-flow change. Outbound Instagram
// DMs now go through the channel-agnostic transport in ./channelService.js.
//
// `fetchLatestIncomingMessage` was a Meta-conversations-API fallback used when
// a webhook delivered a message_edit event without inline text — it no longer
// applies without the Graph API, so it now resolves to null (no fallback).
//
// These thin shims remain only so any not-yet-migrated caller still resolves.
// Prefer importing { sendOutbound } from "./channelService" directly.
const { sendOutbound } = require("./channelService");

const sendDirectMessage = async (_pageId, _accessToken, recipientId, text) =>
  sendOutbound("Instagram", null, recipientId, text);

// No Graph API to poll — returns null so callers fall back gracefully.
const fetchLatestIncomingMessage = async () => null;

module.exports = { sendDirectMessage, fetchLatestIncomingMessage };
