import { api } from "@/utils/API";

/**
 * Google OAuth2 connection (Google Calendar) — real OAuth redirect flow, unlike
 * Instagram's BYO-credentials model (see `instagramMetaService`). The backend
 * never redirects itself for `authorize`; it returns `{ authUrl }` (auth is a
 * Bearer JWT, not a cookie, so the redirect target embeds tenant identity in
 * a signed `state` param) and the frontend does the actual browser redirect.
 * See `.ai/sessions/2026-08-05-google-calendar-oauth-integration.md` for the
 * full architecture (GitHub Issue #30).
 */

export type GoogleConnectionStatus = "disconnected" | "connected" | "token_expired" | "revoked";

// Mirrors the backend's KNOWN_SERVICES allowlist (googleOAuthBootstrap.js). Only
// "calendar" exists today — future services (gmail, drive, ...) get appended here
// in lockstep with the backend enum. See issue #31 session file for the contract.
export type GoogleServiceId = "calendar";

const DEFAULT_SERVICE: GoogleServiceId = "calendar";

export interface GoogleAuthorizeResponse {
  success: boolean;
  authUrl: string;
}

export interface GoogleStatusResponse {
  success: boolean;
  status: GoogleConnectionStatus;
  google_account_email: string | null;
  granted_scopes: string[];
  token_expires_at: string | null;
  last_error: string | null;
}

export interface GoogleDisconnectResponse {
  success: boolean;
}

const GOOGLE_BASE = "/google";

export const googleService = {
  // Returns Google's consent URL — caller must do `window.location.href = authUrl`.
  async authorize(service: GoogleServiceId = DEFAULT_SERVICE): Promise<GoogleAuthorizeResponse> {
    const { data } = await api.get<GoogleAuthorizeResponse>(`${GOOGLE_BASE}/oauth/authorize`, {
      params: { service },
    });
    return data;
  },
  async status(service: GoogleServiceId = DEFAULT_SERVICE): Promise<GoogleStatusResponse> {
    const { data } = await api.get<GoogleStatusResponse>(`${GOOGLE_BASE}/status`, {
      params: { service },
    });
    return data;
  },
  async disconnect(service: GoogleServiceId = DEFAULT_SERVICE): Promise<GoogleDisconnectResponse> {
    const { data } = await api.post<GoogleDisconnectResponse>(`${GOOGLE_BASE}/disconnect`, { service });
    return data;
  },
};
