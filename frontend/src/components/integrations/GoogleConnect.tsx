"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Empty, Spin, Switch, Tag } from "antd";
import { Calendar } from "lucide-react";
import {
  googleService,
  type GoogleCalendarEvent,
  type GoogleConnectionStatus,
  type GoogleServiceId,
} from "@/services/google.service";
import { notifyIntegrationsChanged } from "@/utils/integrationEvents";

type Props = {
  /** Called after the redirect-back query param has been read, so the parent
   * page can show a toast / clear the URL. Not called on plain status loads. */
  onRedirectResult?: (result: "connected" | "denied" | "failed") => void;
  /** Which Google service this card manages. Defaults to "calendar" — the only
   * service that exists today. Plumbing-only prop so future service cards
   * (Gmail, Drive, ...) can reuse this component without another prop-shape
   * change. Does not affect rendered copy/UI today (see issue #31). */
  service?: GoogleServiceId;
};

const STATUS_LABEL: Record<GoogleConnectionStatus, string> = {
  disconnected: "Not connected",
  connected: "Connected",
  token_expired: "Token expired",
  revoked: "Revoked",
};

export function GoogleConnect({ onRedirectResult, service = "calendar" }: Props) {
  const [status, setStatus] = useState<GoogleConnectionStatus>("disconnected");
  const [email, setEmail] = useState<string | null>(null);
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await googleService.status(service);
      setStatus(s.status);
      setEmail(s.google_account_email);
      setGrantedScopes(s.granted_scopes ?? []);
      setLastError(s.last_error ?? null);
      setIsEnabled(s.is_enabled);
      if (s.status === "connected") notifyIntegrationsChanged();
    } catch {
      setStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }, [service]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await googleService.calendarEvents();
      setEvents(res.events);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Calendar events only make sense once connected AND enabled — re-fetch
  // whenever either flips so a toggle-off immediately clears the list
  // without waiting for a manual refresh.
  useEffect(() => {
    if (status === "connected" && isEnabled) {
      void loadEvents();
    } else {
      setEvents([]);
    }
  }, [status, isEnabled, loadEvents]);

  // Backend redirects the browser back here after the OAuth round-trip with
  // `?google=connected` or `?google=error&reason=denied|failed`. Read via
  // window.location.search directly (not useSearchParams) — see codebase
  // precedent in InstagramConnect / billing page (Suspense-boundary issue).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (!result) return;

    if (result === "connected") {
      void loadStatus();
      onRedirectResult?.("connected");
    } else if (result === "error") {
      const reason = params.get("reason");
      onRedirectResult?.(reason === "denied" ? "denied" : "failed");
    }

    // Clean the query params so a refresh doesn't re-trigger the toast.
    const url = new URL(window.location.href);
    url.searchParams.delete("google");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, [loadStatus, onRedirectResult]);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const { authUrl } = await googleService.authorize(service);
      window.location.href = authUrl;
    } catch {
      setError("Failed to start Google sign-in. Please try again.");
      setConnecting(false);
    }
  };

  // Re-enabling re-runs the full authorize→consent round-trip (same as a
  // fresh connect) so Google's own permission screen shows again — flipping
  // is_enabled back to true by itself would silently restore access with no
  // user-visible re-confirmation, which is exactly what this feature is
  // meant to avoid. Disabling is just the toggle call, no redirect needed.
  const handleToggle = async (checked: boolean) => {
    setError(null);
    if (checked) {
      setConnecting(true);
      try {
        const { authUrl } = await googleService.authorize(service);
        window.location.href = authUrl;
      } catch {
        setError("Failed to start Google sign-in. Please try again.");
        setConnecting(false);
      }
      return;
    }

    setToggling(true);
    try {
      const res = await googleService.toggle(false, service);
      setIsEnabled(res.is_enabled);
      notifyIntegrationsChanged();
    } catch {
      setError("Failed to update Google Calendar setting.");
    } finally {
      setToggling(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setDisconnecting(true);
    try {
      await googleService.disconnect(service);
      setStatus("disconnected");
      setEmail(null);
      setGrantedScopes([]);
      setLastError(null);
      notifyIntegrationsChanged();
    } catch {
      setError("Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = status === "connected";
  const isExpired = status === "token_expired";
  const hasCalendar = grantedScopes.some((s) => s.includes("calendar"));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Status</span>
        <Tag color={isConnected ? "green" : isExpired ? "orange" : "default"}>{STATUS_LABEL[status]}</Tag>
        {isConnected && email && <span className="font-mono text-xs text-slate-400">{email}</span>}
      </div>

      {error && <Alert type="error" message={error} showIcon />}
      {!error && lastError && <Alert type="warning" message={lastError} showIcon />}

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8">
          <Spin />
          <p className="text-xs text-slate-500">Checking connection status…</p>
        </div>
      ) : !isConnected ? (
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-amber-600" />
            <p className="text-sm text-slate-600">
              Connect your Google account to sync Google Calendar with this clinic.
            </p>
          </div>
          <Button type="primary" loading={connecting} onClick={() => void handleConnect()}>
            Connect Google
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-amber-600" />
              <div>
                <p className="text-sm font-medium text-slate-800">Google Calendar</p>
                <p className="text-xs text-slate-500">
                  {!hasCalendar
                    ? "Connected — calendar access not yet granted."
                    : isEnabled
                      ? "Connected and syncing."
                      : "Connected, but disabled — calendar sync is paused."}
                </p>
              </div>
            </div>
            {hasCalendar ? (
              <Switch checked={isEnabled} loading={toggling || connecting} onChange={(checked) => void handleToggle(checked)} />
            ) : (
              <Tag color="default">Coming soon</Tag>
            )}
          </div>

          {hasCalendar && isEnabled && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-medium text-slate-600">Upcoming events</p>
              {eventsLoading ? (
                <div className="flex justify-center py-4">
                  <Spin size="small" />
                </div>
              ) : events.length === 0 ? (
                <Empty description="No upcoming events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <ul className="space-y-2">
                  {events.map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="truncate text-sm text-slate-700">{event.title}</span>
                      <span className="whitespace-nowrap text-xs text-slate-400">
                        {event.start ? new Date(event.start).toLocaleString() : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button danger size="small" loading={disconnecting} onClick={() => void handleDisconnect()}>
            Disconnect Google
          </Button>
        </div>
      )}
    </div>
  );
}

export default GoogleConnect;
