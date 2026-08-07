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
  is_enabled: boolean;
}

export interface GoogleDisconnectResponse {
  success: boolean;
}

export interface GoogleToggleResponse {
  success: boolean;
  is_enabled: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
}

export interface GoogleCalendarEventsResponse {
  success: boolean;
  events: GoogleCalendarEvent[];
}

export interface GoogleCalendarEventInput {
  title: string;
  start: string;
  end: string;
}

export interface GoogleCalendarEventResponse {
  success: boolean;
  event: GoogleCalendarEvent;
}

export interface GoogleCalendarDeleteResponse {
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
  // Flips is_enabled without touching the underlying connection/tokens.
  // Turning back on does NOT re-show Google's consent screen by itself —
  // call authorize() again for that (it always sends prompt=consent).
  async toggle(
    isEnabled: boolean,
    service: GoogleServiceId = DEFAULT_SERVICE,
  ): Promise<GoogleToggleResponse> {
    const { data } = await api.post<GoogleToggleResponse>(`${GOOGLE_BASE}/toggle`, {
      service,
      is_enabled: isEnabled,
    });
    return data;
  },
  async calendarEvents(): Promise<GoogleCalendarEventsResponse> {
    const { data } = await api.get<GoogleCalendarEventsResponse>(`${GOOGLE_BASE}/calendar/events`);
    return data;
  },
  // Edits directly on Google's calendar — there is no local Appointment
  // record yet, so Google Calendar itself is the store of record here.
  async updateCalendarEvent(
    eventId: string,
    input: GoogleCalendarEventInput,
  ): Promise<GoogleCalendarEventResponse> {
    const { data } = await api.patch<GoogleCalendarEventResponse>(
      `${GOOGLE_BASE}/calendar/events/${encodeURIComponent(eventId)}`,
      input,
    );
    return data;
  },
  async deleteCalendarEvent(eventId: string): Promise<GoogleCalendarDeleteResponse> {
    const { data } = await api.delete<GoogleCalendarDeleteResponse>(
      `${GOOGLE_BASE}/calendar/events/${encodeURIComponent(eventId)}`,
    );
    return data;
  },
};
