"use strict";

/**
 * googleOAuthClient.js — thin wrapper around googleapis' OAuth2Client for
 * Google Calendar OAuth. Isolates the googleapis SDK to this one file
 * (mirrors metaGraphApi.js's role as the "external API wrapper" for
 * Instagram). Owns: auth URL generation, code→token exchange, userinfo
 * lookup, access-token refresh, and token revocation.
 *
 * Nothing in this file touches the DB or encryption — googleOAuthBootstrap.js
 * calls this for the Google-facing HTTP calls and handles persistence/
 * encryption itself.
 */

const { google } = require("googleapis");
const log = require("../utils/logger");

const MODULE = "GoogleOAuthClient";

// Per-service scope map — only "calendar" is functionally wired today;
// future services (Gmail/Drive) add a new key here, no other change needed.
const SCOPES_BY_SERVICE = {
  calendar: ["https://www.googleapis.com/auth/calendar"],
};

// Identity scopes (not service-specific) — resolve the connected account's
// display email for the UI. Always included alongside a service's scopes.
const IDENTITY_SCOPES = ["openid", "email"];

/** Resolve the full scope list to request for a given service. Throws on an
 *  unknown service — callers must validate against a known-service allowlist
 *  before reaching here (see googleOAuthBootstrap.js's KNOWN_SERVICES). */
function scopesForService(service) {
  const serviceScopes = SCOPES_BY_SERVICE[service];
  if (!serviceScopes) throw new Error(`Unknown Google service: ${service}`);
  return [...IDENTITY_SCOPES, ...serviceScopes];
}

function redirectUri() {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  return `${backendUrl}/api/google/oauth/callback`;
}

function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );
}

/** Build Google's consent URL. `state` carries the HMAC-signed tenant id +
 *  service (signed by the caller) since Google's callback hits us with no
 *  Bearer header. `access_type: "offline"` + `prompt: "consent"` ensure a
 *  refresh token is issued even on a re-connect. `service` resolves which
 *  scopes to request via `scopesForService`. */
function getAuthUrl({ state, service }) {
  const client = buildOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopesForService(service),
    state,
  });
}

/** Exchange an authorization code for tokens, and resolve the connected
 *  account's email via the userinfo endpoint. Returns
 *  { accessToken, refreshToken, expiryDate, email, scopes }. */
async function exchangeCode(code) {
  const client = buildOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    email = data?.email || null;
  } catch (err) {
    log.warn(MODULE, "exchangeCode:userinfoFailed", { error: err.message });
  }

  return {
    accessToken: tokens.access_token || null,
    refreshToken: tokens.refresh_token || null,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email,
    // Defensive fallback for the rare case Google's token response omits
    // `scope` — the actual granted scopes always come from Google's
    // response, not from our request, so this is just a log-worthy anomaly
    // guard, not a normal path.
    scopes: tokens.scope ? tokens.scope.split(" ") : [],
  };
}

/** Use a stored refresh token to mint a fresh access token. Returns
 *  { accessToken, expiryDate }. Throws if Google rejects the refresh token
 *  (e.g. revoked) — caller decides how to reflect that in `status`. */
async function refreshAccessToken(refreshToken) {
  const client = buildOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return {
    accessToken: credentials.access_token || null,
    expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

/** Best-effort revoke of a Google access token (used on disconnect). Never
 *  throws — Google may already consider the token revoked/expired. */
async function revokeToken(accessToken) {
  if (!accessToken) return;
  try {
    const client = buildOAuth2Client();
    await client.revokeToken(accessToken);
  } catch (err) {
    log.warn(MODULE, "revokeToken", { error: err.message });
  }
}

/** List upcoming events on the connected account's primary calendar. Caller
 *  supplies an already-valid plaintext access token (see
 *  googleOAuthBootstrap.js's getValidAccessToken) — this function does not
 *  refresh or persist anything. Returns Google's raw event objects, mapped
 *  down to the fields the UI actually needs. Throws on API failure — caller
 *  decides how to surface that. */
async function listUpcomingEvents(accessToken, { maxResults = 10 } = {}) {
  const client = buildOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  const { data } = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || "(No title)",
    start: event.start?.dateTime || event.start?.date || null,
    end: event.end?.dateTime || event.end?.date || null,
    htmlLink: event.htmlLink || null,
  }));
}

/** Update an existing event's title/start/end on the connected account's
 *  primary calendar. `start`/`end` are ISO datetime strings — always sent as
 *  timed events (dateTime), matching what the UI's edit form collects; this
 *  never has to round-trip an all-day date-only event back to Google in the
 *  same all-day shape, since the UI doesn't create/edit all-day events.
 *  Throws on API failure (e.g. event deleted on Google's side, bad token) —
 *  caller decides how to surface that. */
async function updateEvent(accessToken, eventId, { title, start, end }) {
  const client = buildOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  const { data } = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: {
      summary: title,
      start: { dateTime: start },
      end: { dateTime: end },
    },
  });

  return {
    id: data.id,
    title: data.summary || "(No title)",
    start: data.start?.dateTime || data.start?.date || null,
    end: data.end?.dateTime || data.end?.date || null,
    htmlLink: data.htmlLink || null,
  };
}

/** Delete an event from the connected account's primary calendar. Treats an
 *  already-gone event (404/410 — deleted directly on Google's side since we
 *  last listed it) as a successful no-op rather than an error, since the
 *  caller's intent ("this event should not exist") is already satisfied. */
async function deleteEvent(accessToken, eventId) {
  const client = buildOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: client });

  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
  } catch (err) {
    const code = err?.code || err?.response?.status;
    if (code === 404 || code === 410) return;
    throw err;
  }
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  revokeToken,
  updateEvent,
  deleteEvent,
  listUpcomingEvents,
};
