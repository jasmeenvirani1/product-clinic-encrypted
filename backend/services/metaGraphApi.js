"use strict";

/**
 * metaGraphApi.js — thin wrapper around Meta's Graph API HTTP calls used for
 * outbound Instagram messaging and IG Business Account lookups. No Meta SDK
 * dependency — plain axios (already a dependency, used elsewhere e.g.
 * mediaIngest.js) is sufficient for these REST calls.
 *
 * CORRECTED (2026-07-31): there is no shared platform Meta App, so there is
 * no OAuth authorize/callback flow to wrap here anymore. Each tenant supplies
 * their OWN App ID / App Secret / Access Token / IG Business Account ID
 * directly (see backend/routes/instagramMetaRoutes.js), so every function
 * below takes the credentials it needs as parameters — nothing is read from
 * a global/shared env var.
 *
 * Zero MedLeads/CRM knowledge — pure Graph API request helpers. Token
 * storage, tenant resolution, etc. live in instagramDmBootstrap.js /
 * instagramMetaRoutes.js / webhookController.js.
 */

const axios = require("axios");
const log = require("../utils/logger");

const MODULE = "MetaGraphApi";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Resolve the connected IG Business Account's username, for display purposes only. */
async function getIgBusinessAccountUsername({ igBusinessAccountId, accessToken }) {
  const resp = await axios.get(`${GRAPH_BASE}/${igBusinessAccountId}`, {
    params: { fields: "username", access_token: accessToken },
  });
  return resp.data?.username || null;
}

/** Send a text DM via the Instagram Business Account's messaging endpoint. */
async function sendInstagramMessage({ igBusinessAccountId, accessToken, recipientId, text }) {
  const resp = await axios.post(
    `${GRAPH_BASE}/${igBusinessAccountId}/messages`,
    { recipient: { id: recipientId }, message: { text } },
    { params: { access_token: accessToken } }
  );
  return resp.data;
}

/** Lightweight health-check call — used to detect an invalid/expired
 *  clinic-supplied access token without sending a real message. Throws on
 *  auth failure so callers can distinguish "token is bad" from other errors. */
async function verifyAccessToken({ igBusinessAccountId, accessToken }) {
  const resp = await axios.get(`${GRAPH_BASE}/${igBusinessAccountId}`, {
    params: { fields: "id", access_token: accessToken },
  });
  return !!resp.data?.id;
}

/** Fetch this tenant's Instagram Reels (media_product_type === "REELS") via the
 *  IG Business Account's /media edge. There is no server-side Reels-only
 *  filter in Graph API — we request media_product_type as a field and filter
 *  client-side. Requires the instagram_business_basic scope (renamed from
 *  the deprecated instagram_basic, retired by Meta 2025-01-27) on the stored
 *  access token. Throws on Graph API errors (e.g. missing scope) — callers
 *  are responsible for catching/logging/skipping, per this file's
 *  credentials-as-parameters, zero-CRM-knowledge convention. */
async function getReels({ igBusinessAccountId, accessToken, limit = 25 }) {
  const resp = await axios.get(`${GRAPH_BASE}/${igBusinessAccountId}/media`, {
    params: {
      fields:
        "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count",
      limit,
      access_token: accessToken,
    },
  });
  const items = resp.data?.data || [];
  return items.filter((m) => m.media_product_type === "REELS");
}

module.exports = {
  GRAPH_VERSION,
  GRAPH_BASE,
  getIgBusinessAccountUsername,
  sendInstagramMessage,
  verifyAccessToken,
  getReels,
};
