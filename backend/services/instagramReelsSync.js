"use strict";

/**
 * instagramReelsSync.js — periodic sync job that populates/refreshes the
 * InstagramReel table from each connected tenant's Instagram Business
 * Account, for display on the public clinic profile page (issue #33).
 *
 * DELIBERATELY SEPARATE from instagramDmBootstrap.js's checkTokenHealth().
 * That function's entire purpose is a narrow DM-channel liveness probe
 * (verifyAccessToken -> flips InstagramSession.status/last_error on 401/403).
 * Reels sync is a fundamentally different concern (bulk content fetch +
 * upsert into InstagramReel) with its own, unrelated failure mode (missing
 * the instagram_business_basic scope on an otherwise-healthy DM token) that
 * must NOT be conflated with DM-channel status — a reels-scope-only failure
 * must never flip a perfectly-working DM connection to "token_expired".
 * This job therefore NEVER writes to InstagramSession; it only reads it.
 *
 * Sync is a scheduled background job (not on-demand inside the public
 * profile endpoint) so that GET /api/public/clinics/:username stays a fast,
 * local-table read with no external Graph API call on every anonymous page
 * view.
 */

const { InstagramSession, InstagramReel } = require("../models");
const metaGraph = require("./metaGraphApi");
const log = require("../utils/logger");

const MODULE = "InstagramReelsSync";

// Same 24h cadence as instagramDmBootstrap's token health check — coincidentally
// reasonable for content that doesn't change minute-to-minute.
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

// How many most-recent reels to keep synced per tenant — matches the public
// profile grid's realistic display count (no pagination UI exists for this
// section) and metaGraph.getReels' own default limit.
const REELS_LIMIT = 25;

/** Start the reels sync job: run once shortly after boot, then on a fixed
 *  interval. Call once at startup, alongside mountInstagramMeta(...). */
function startInstagramReelsSync() {
  void syncAllTenants();
  setInterval(() => void syncAllTenants(), SYNC_INTERVAL_MS);
  log.info(MODULE, "reelsSyncJobScheduled", { intervalMs: SYNC_INTERVAL_MS });
}

/** Sync reels for every tenant with a connected Instagram session. Errors
 *  for one tenant are caught and logged so they never block the others. */
async function syncAllTenants() {
  try {
    const sessions = await InstagramSession.findAll({ where: { status: "connected" } });
    for (const session of sessions) {
      try {
        await syncTenantReels(session);
      } catch (err) {
        log.warn(MODULE, "syncTenantReelsFailed", {
          tenantId: session.tenant_id,
          slot: session.slot,
          error: err.message,
        });
      }
    }
  } catch (err) {
    log.error(MODULE, "syncAllTenants", { error: err.message });
  }
}

/** Fetch + upsert reels for a single tenant's InstagramSession row. Graph API
 *  errors (e.g. token missing the instagram_business_basic scope) are caught
 *  here and logged only — this NEVER mutates InstagramSession.status, since
 *  that field is DM-channel-health-specific, not reels-read-health. */
async function syncTenantReels(session) {
  if (!session.access_token || !session.ig_business_account_id) return;

  let reels;
  try {
    reels = await metaGraph.getReels({
      igBusinessAccountId: session.ig_business_account_id,
      accessToken: session.access_token,
      limit: REELS_LIMIT,
    });
  } catch (err) {
    // Expected for tokens that predate the instagram_business_basic scope
    // migration — DM sending may still work fine on the same token. Silent
    // skip + log, not a session-status mutation.
    log.warn(MODULE, "getReelsFailed", {
      tenantId: session.tenant_id,
      slot: session.slot,
      status: err.response?.status,
      error: err.response?.data || err.message,
    });
    return;
  }

  const now = new Date();
  for (const reel of reels) {
    const [row] = await InstagramReel.findOrCreate({
      where: {
        tenant_id: session.tenant_id,
        slot: session.slot,
        ig_media_id: reel.id,
      },
      defaults: {
        tenant_id: session.tenant_id,
        slot: session.slot,
        ig_media_id: reel.id,
      },
    });

    await row.update({
      media_type: reel.media_type ?? null,
      media_product_type: reel.media_product_type ?? null,
      caption: reel.caption ?? null,
      media_url: reel.media_url ?? null,
      thumbnail_url: reel.thumbnail_url ?? null,
      permalink: reel.permalink ?? null,
      like_count: reel.like_count ?? 0,
      comments_count: reel.comments_count ?? 0,
      posted_at: reel.timestamp ? new Date(reel.timestamp) : null,
      last_synced_at: now,
    });
  }

  log.info(MODULE, "syncTenantReelsComplete", {
    tenantId: session.tenant_id,
    slot: session.slot,
    count: reels.length,
  });
}

module.exports = {
  startInstagramReelsSync,
  syncAllTenants,
  syncTenantReels,
};
