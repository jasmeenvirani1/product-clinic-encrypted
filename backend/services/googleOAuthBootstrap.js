"use strict";

/**
 * googleOAuthBootstrap.js — mounts /api/google/* for the Google Calendar
 * OAuth2 integration. Mirrors whatsappQrBootstrap.js / instagramDmBootstrap.js's
 * `mount<X>(app, { authMiddleware })` factory contract.
 *
 * Auth-bridging: this app sends `Authorization: Bearer <JWT>` from
 * localStorage, not cookies, so a plain browser redirect to
 * /oauth/authorize carries no Bearer header. Resolution (per architecture):
 * /oauth/authorize is called as an authenticated axios request and returns
 * `{ authUrl }` JSON — the frontend itself does `window.location.href =
 * authUrl`. The tenant id is embedded in OAuth's `state` param, signed with
 * JWT_SECRET (same secret already used for this app's auth tokens — NOT the
 * token-encryption secret, per .claude/rules/oauth-token-storage.md) so
 * /oauth/callback (hit directly by Google, no Bearer header available) can
 * recover the tenant id itself.
 *
 * Only Google Calendar is functionally wired today — the architecture
 * collapses the brief's 4-endpoint sketch into a single authorize/callback
 * pair, but every route now accepts an optional `service` param (default
 * "calendar", validated against KNOWN_SERVICES) so each service's
 * GoogleConnection row is created/read/updated independently, scoped by
 * (tenant_id, service). See session file for rationale.
 */

const jwt = require("jsonwebtoken");
const { GoogleConnection } = require("../models");
const googleOAuthClient = require("./googleOAuthClient");
const tokenCrypto = require("../utils/tokenCrypto");
const log = require("../utils/logger");

const MODULE = "GoogleOAuth";

const STATE_PURPOSE = "google_oauth_state";
const STATE_TTL = "10m";

// Single source of truth for the HTTP-level "reject unknown service" policy.
// Must be kept in sync with googleOAuthClient.js's SCOPES_BY_SERVICE keys.
const KNOWN_SERVICES = ["calendar"];
const DEFAULT_SERVICE = "calendar";

// Allowlist of pages allowed to be the post-OAuth redirect target. Both the
// clinic-facing and super-admin-facing "App Connections" pages run this same
// self-connect widget (see issue #32). Deliberately a closed set, never a
// client-trusted arbitrary string — `state` is server-signed, but the value
// signed into it is still validated against this allowlist before signing
// AND again defensively on the way out, so this can never become an open
// redirect even if some future call site starts trusting caller input.
const RETURN_PATH_ALLOWLIST = ["/app/connections", "/super-admin/connections"];
const DEFAULT_RETURN_PATH = "/app/connections";

function frontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim();
}

/** Narrows any candidate return path down to the allowlist, falling back to
 *  the clinic page (today's pre-existing hardcoded behavior) for anything
 *  absent/unrecognized. Never trust this value without passing it through
 *  here first — this is the one and only open-redirect guard. */
function sanitizeReturnPath(candidate) {
  return RETURN_PATH_ALLOWLIST.includes(candidate) ? candidate : DEFAULT_RETURN_PATH;
}

function signState(tenantId, service, returnPath) {
  return jwt.sign(
    { tenantId, service, returnPath: sanitizeReturnPath(returnPath), purpose: STATE_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL },
  );
}

/** Returns { tenantId, service, returnPath } encoded in `state`, or null if
 *  invalid/expired/wrong purpose/unknown service. `returnPath` is always
 *  re-sanitized against the allowlist here too (defense in depth, and also
 *  covers state tokens signed before this field existed — those decode with
 *  `returnPath: undefined`, which sanitizes to the clinic-page default). */
function verifyState(state) {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    if (
      decoded.purpose !== STATE_PURPOSE ||
      !decoded.tenantId ||
      !KNOWN_SERVICES.includes(decoded.service)
    ) {
      return null;
    }
    return {
      tenantId: decoded.tenantId,
      service: decoded.service,
      returnPath: sanitizeReturnPath(decoded.returnPath),
    };
  } catch (err) {
    log.warn(MODULE, "verifyState", { error: err.message });
    return null;
  }
}

/** Get a valid (non-expired) plaintext access token for in-process use,
 *  refreshing via the stored refresh token when needed. Returns null when
 *  the tenant has no connected row, no refresh token, or the row is
 *  disabled (is_enabled: false — a disabled connection must never yield a
 *  usable token to feature code, even though the underlying tokens are
 *  still intact in the DB). Never returned over HTTP. */
async function getValidAccessToken(connectionRow) {
  if (!connectionRow || !connectionRow.refresh_token || !connectionRow.is_enabled) return null;

  const needsRefresh =
    !connectionRow.access_token ||
    !connectionRow.token_expires_at ||
    new Date(connectionRow.token_expires_at).getTime() <= Date.now() + 60 * 1000;

  if (!needsRefresh) {
    return tokenCrypto.decrypt(connectionRow.access_token);
  }

  const refreshToken = tokenCrypto.decrypt(connectionRow.refresh_token);
  const { accessToken, expiryDate } = await googleOAuthClient.refreshAccessToken(refreshToken);
  await connectionRow.update({
    access_token: accessToken ? tokenCrypto.encrypt(accessToken) : null,
    token_expires_at: expiryDate,
    status: "connected",
    last_error: null,
  });
  return accessToken;
}

function mountGoogleOAuth(app, { authMiddleware } = {}) {
  // GET /api/google/oauth/authorize — authenticated. Returns { authUrl }; the
  // frontend redirects the browser itself (does NOT redirect server-side).
  app.get("/api/google/oauth/authorize", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

      const service = req.query.service || DEFAULT_SERVICE;
      if (!KNOWN_SERVICES.includes(service)) {
        return res.status(400).json({ success: false, message: "Unknown Google service." });
      }

      // Role-derived default (super admin's own "App Connections" page vs the
      // clinic-facing one) — the caller may also pass `returnPath` explicitly
      // (e.g. if it's ever embedded elsewhere), but either way the value is
      // narrowed to RETURN_PATH_ALLOWLIST inside signState/sanitizeReturnPath
      // before it's ever signed into `state`, so this can't become an open
      // redirect regardless of what the client sends.
      const roleDefault =
        req.user?.Role?.name === "super_admin" ? "/super-admin/connections" : DEFAULT_RETURN_PATH;
      const returnPath = req.query.returnPath || roleDefault;

      const state = signState(tenantId, service, returnPath);
      const authUrl = googleOAuthClient.getAuthUrl({ state, service });
      return res.json({ success: true, authUrl });
    } catch (err) {
      log.error(MODULE, "authorize", { error: err.message });
      return res.status(500).json({ success: false, message: "Failed to build Google authorization URL." });
    }
  });

  // GET /api/google/oauth/callback — public (Google calls this directly, no
  // Bearer header). Always redirects back into the app, even on failure.
  app.get("/api/google/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query;

    // Google still echoes back `state` on user-denied consent, so best-effort
    // decode it here too — lets a super-admin-initiated denial land back on
    // /super-admin/connections instead of always falling back to the clinic
    // page. If `state` is missing/invalid we have no return path to recover,
    // so DEFAULT_RETURN_PATH (today's pre-existing behavior) is the only
    // sane fallback for that edge case.
    if (error) {
      log.warn(MODULE, "callback:denied", { error });
      const decodedOnDenied = state ? verifyState(state) : null;
      return res.redirect(
        `${frontendUrl()}${decodedOnDenied?.returnPath || DEFAULT_RETURN_PATH}?google=error&reason=denied`,
      );
    }

    const decoded = state ? verifyState(state) : null;
    const { tenantId, service, returnPath } = decoded || {};
    if (!tenantId || !service || !code) {
      log.warn(MODULE, "callback:invalidState", { hasState: !!state, hasCode: !!code });
      return res.redirect(
        `${frontendUrl()}${returnPath || DEFAULT_RETURN_PATH}?google=error&reason=failed`,
      );
    }

    try {
      const { accessToken, refreshToken, expiryDate, email, scopes } = await googleOAuthClient.exchangeCode(code);

      const [row] = await GoogleConnection.findOrCreate({
        where: { tenant_id: tenantId, service },
        defaults: { tenant_id: tenantId, service },
      });

      await row.update({
        status: "connected",
        // A completed OAuth round-trip (fresh consent screen, prompt=consent)
        // is exactly the re-enable signal per the toggle feature's design —
        // so reconnecting always turns the service back on, even if it had
        // been manually disabled before this authorize call.
        is_enabled: true,
        google_account_email: email,
        access_token: accessToken ? tokenCrypto.encrypt(accessToken) : row.access_token,
        // Google only returns a refresh_token on first consent (or when
        // prompt=consent forces a fresh one, as we always request) — but
        // guard anyway so a re-connect never wipes a previously stored one.
        refresh_token: refreshToken ? tokenCrypto.encrypt(refreshToken) : row.refresh_token,
        token_expires_at: expiryDate,
        granted_scopes: scopes,
        last_error: null,
      });

      return res.redirect(`${frontendUrl()}${returnPath}?google=connected`);
    } catch (err) {
      log.error(MODULE, "callback", { tenantId, service, error: err.message });
      return res.redirect(`${frontendUrl()}${returnPath || DEFAULT_RETURN_PATH}?google=error&reason=failed`);
    }
  });

  // GET /api/google/status — authenticated. Never returns token fields.
  app.get("/api/google/status", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

      const service = req.query.service || DEFAULT_SERVICE;
      if (!KNOWN_SERVICES.includes(service)) {
        return res.status(400).json({ success: false, message: "Unknown Google service." });
      }

      const row = await GoogleConnection.findOne({ where: { tenant_id: tenantId, service } });
      return res.json({
        success: true,
        status: row?.status || "disconnected",
        google_account_email: row?.google_account_email || null,
        granted_scopes: row?.granted_scopes || [],
        token_expires_at: row?.token_expires_at || null,
        last_error: row?.last_error || null,
        is_enabled: row ? row.is_enabled : true,
      });
    } catch (err) {
      log.error(MODULE, "status", { error: err.message });
      return res.status(500).json({ success: false, message: "Failed to load Google connection status." });
    }
  });

  // POST /api/google/toggle — authenticated. Flips is_enabled on an already-
  // connected row WITHOUT touching tokens/status — the Google account stays
  // connected, disabling just stops feature code (Calendar events, future
  // AI-booking writes) from being able to use it (see getValidAccessToken's
  // is_enabled check). Turning back on does NOT re-show Google's consent
  // screen by itself — the frontend re-triggers /oauth/authorize (which
  // always sends prompt=consent) for that, since only a real OAuth
  // round-trip can re-surface Google's own permission UI.
  app.post("/api/google/toggle", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

      const service = req.body?.service || req.query.service || DEFAULT_SERVICE;
      if (!KNOWN_SERVICES.includes(service)) {
        return res.status(400).json({ success: false, message: "Unknown Google service." });
      }
      if (typeof req.body?.is_enabled !== "boolean") {
        return res.status(400).json({ success: false, message: "is_enabled must be a boolean." });
      }

      const row = await GoogleConnection.findOne({ where: { tenant_id: tenantId, service } });
      if (!row) {
        return res.status(404).json({ success: false, message: "No Google connection found." });
      }

      await row.update({ is_enabled: req.body.is_enabled });
      return res.json({ success: true, is_enabled: row.is_enabled });
    } catch (err) {
      log.error(MODULE, "toggle", { error: err.message });
      return res.status(500).json({ success: false, message: "Failed to update Google connection." });
    }
  });

  // GET /api/google/calendar/events — authenticated. Returns the connected
  // account's upcoming primary-calendar events. Empty list (not an error)
  // when disconnected or disabled — getValidAccessToken already refuses to
  // yield a token for a disabled row, so this route can't leak events for a
  // service the clinic turned off.
  app.get("/api/google/calendar/events", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

      const row = await GoogleConnection.findOne({ where: { tenant_id: tenantId, service: "calendar" } });
      const accessToken = await getValidAccessToken(row);
      if (!accessToken) {
        return res.json({ success: true, events: [] });
      }

      const events = await googleOAuthClient.listUpcomingEvents(accessToken);
      return res.json({ success: true, events });
    } catch (err) {
      log.error(MODULE, "calendarEvents", { error: err.message });
      return res.status(500).json({ success: false, message: "Failed to load Google Calendar events." });
    }
  });

  // POST /api/google/disconnect — authenticated. Best-effort revoke with
  // Google, then null credential fields (never destroy() the row).
  app.post("/api/google/disconnect", authMiddleware, async (req, res) => {
    try {
      const tenantId = req.user?.tenant_id || req.user?.id;
      if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

      const service = req.body?.service || req.query.service || DEFAULT_SERVICE;
      if (!KNOWN_SERVICES.includes(service)) {
        return res.status(400).json({ success: false, message: "Unknown Google service." });
      }

      const row = await GoogleConnection.findOne({ where: { tenant_id: tenantId, service } });
      if (row) {
        if (row.access_token) {
          try {
            await googleOAuthClient.revokeToken(tokenCrypto.decrypt(row.access_token));
          } catch (err) {
            log.warn(MODULE, "disconnect:revokeFailed", { tenantId, error: err.message });
          }
        }
        await row.update({
          status: "disconnected",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          granted_scopes: [],
          last_error: null,
        });
      }

      return res.json({ success: true });
    } catch (err) {
      log.error(MODULE, "disconnect", { error: err.message });
      return res.status(500).json({ success: false, message: "Failed to disconnect Google account." });
    }
  });

  log.info(MODULE, "mounted", { route: "/api/google" });
}

module.exports = { mountGoogleOAuth, getValidAccessToken };
