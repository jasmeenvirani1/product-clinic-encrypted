"use strict";

/**
 * instagramDmBootstrap.js — MedLeads-specific bridge between Meta's
 * Instagram Graph API and the MedLeads AI/CRM pipeline. This file keeps its
 * original name and its two exported contract functions
 * (`sendInstagramText`, `slotForConversation`) unchanged so `channelService.js`
 * needs no signature change — only the internal implementation changes.
 *
 * CORRECTED (2026-07-31): there is no shared platform Meta App and no OAuth
 * flow anymore. Each tenant supplies their OWN App ID / App Secret / Access
 * Token / IG Business Account ID directly (see
 * backend/routes/instagramMetaRoutes.js), so outbound sends look up and use
 * THAT tenant's own stored access token and IG Business Account ID.
 *
 * `mountInstagramMeta(app, { authMiddleware })` mounts the credential-entry
 * + webhook-info routes — this replaces the old `mountInstagramOAuth`.
 *
 * Inbound Instagram DMs arrive via the per-tenant Meta webhook
 * (`webhookController.instagramReceive`), NOT through this file — this file
 * only owns outbound send + route mounting + the token health-check below.
 *
 * Token refresh decision: since these are user-provided long-lived tokens
 * (not obtained via our own OAuth flow), we CANNOT silently refresh them via
 * a refresh-token exchange the way OAuth apps normally would — there is no
 * refresh token, only whatever long-lived token the clinic pasted in. So
 * instead of a refresh job, this runs a periodic HEALTH CHECK: it pings the
 * Graph API with each stored token and flags ones that are failing by
 * setting `status = "token_expired"` + a clear `last_error`, prompting the
 * clinic to generate and re-paste a fresh token from their own Meta
 * dashboard. This is the pragmatic option given tokens are manually supplied.
 *
 * WhatsApp is never referenced here.
 */

const { InstagramSession } = require("../models");
const { createInstagramMetaRouter } = require("../routes/instagramMetaRoutes");
const metaGraph = require("./metaGraphApi");
const log = require("../utils/logger");

const MODULE = "InstagramDM";

// Kept parameterized for parity with WhatsApp's multi-slot pattern, though
// only slot 1 is exposed in the UI today (one IG Business Account per tenant).
const MAX_SLOTS_PER_TENANT = 1;

// Health-check every 24h — pings Graph API with each stored token and flags
// ones that are failing. No refresh is attempted (see file header) since
// these tokens are manually supplied by each clinic, not obtained via our
// own OAuth flow, so there is nothing to exchange/refresh against.
const HEALTH_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Initialize the Instagram Meta channel: mount its REST routes and start
 *  the token health-check job. Call once at startup. */
function mountInstagramMeta(app, { authMiddleware } = {}) {
  app.use("/api/instagram-meta", createInstagramMetaRouter({ authMiddleware }));

  // Run once shortly after boot, then on the fixed interval — mirrors the
  // processFollowups() job pattern already used in backend/index.js.
  void checkTokenHealth();
  setInterval(() => void checkTokenHealth(), HEALTH_CHECK_INTERVAL_MS);
  log.info(MODULE, "tokenHealthCheckJobScheduled", { intervalMs: HEALTH_CHECK_INTERVAL_MS });
}

/** Ping Graph API with each connected tenant's own stored access token;
 *  flag any that fail with an auth error so the UI can prompt a fresh paste. */
async function checkTokenHealth() {
  try {
    const rows = await InstagramSession.findAll({ where: { status: "connected" } });
    for (const row of rows) {
      if (!row.access_token || !row.ig_business_account_id) continue;
      try {
        await metaGraph.verifyAccessToken({
          igBusinessAccountId: row.ig_business_account_id,
          accessToken: row.access_token,
        });
      } catch (err) {
        const status = err.response?.status;
        // Only flag on actual auth failures (401/403/OAuthException-shaped
        // errors) — transient network/5xx errors shouldn't force a
        // reconnect prompt for a token that may still be perfectly valid.
        if (status === 401 || status === 403) {
          await row.update({
            status: "token_expired",
            last_error: "Instagram access token is invalid or expired — please generate a fresh long-lived token from your Meta dashboard and re-paste it.",
          });
          log.warn(MODULE, "tokenHealthCheckFailed", { tenantId: row.tenant_id, slot: row.slot, status });
        } else {
          log.warn(MODULE, "tokenHealthCheckTransientError", { tenantId: row.tenant_id, slot: row.slot, error: err.message });
        }
      }
    }
  } catch (err) {
    log.error(MODULE, "checkTokenHealth", { error: err.message });
  }
}

/** Resolve which slot a conversation's replies should go out on. Instagram
 *  only supports a single linked account per tenant today (MAX_SLOTS_PER_TENANT
 *  = 1), so this always resolves to slot 1 — kept as a function for parity
 *  with WhatsApp's per-conversation slot and to make future multi-account
 *  support a non-breaking change (would read a dedicated column then). */
function slotForConversation(_conversation) {
  return 1;
}

/** Send an Instagram DM text via Meta's Graph API using the tenant's OWN
 *  stored App credentials/access token (no shared/global app). `slot`
 *  selects which linked account (defaults to 1). Used by channelService for
 *  manual replies, in-app AI replies, and follow-ups. `recipientId` is the
 *  sender's IGSID captured on inbound (Meta's webhook `sender.id`). */
async function sendInstagramText(tenantId, recipientId, text, slot = 1) {
  const row = await InstagramSession.findOne({ where: { tenant_id: tenantId, slot } });
  if (!row || row.status !== "connected" || !row.access_token || !row.ig_business_account_id) {
    throw new Error("Instagram channel not connected for this tenant");
  }

  try {
    return await metaGraph.sendInstagramMessage({
      igBusinessAccountId: row.ig_business_account_id,
      accessToken: row.access_token,
      recipientId,
      text,
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      await row.update({
        status: "token_expired",
        last_error: "Instagram access token is invalid or expired — please generate a fresh long-lived token from your Meta dashboard and re-paste it.",
      });
    }
    log.error(MODULE, "sendInstagramText", { tenantId, slot, error: err.response?.data || err.message });
    throw err;
  }
}

module.exports = {
  mountInstagramMeta,
  sendInstagramText,
  slotForConversation,
  MAX_SLOTS_PER_TENANT,
};
