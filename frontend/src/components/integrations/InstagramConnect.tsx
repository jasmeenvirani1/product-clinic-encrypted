"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input, Spin, Tag } from "antd";
import { Instagram, LogOut, KeyRound } from "lucide-react";
import {
  instagramDmService,
  type InstagramDmStatus,
} from "@/services/aiSetting.service";
import { notifyIntegrationsChanged } from "@/utils/integrationEvents";

type Props = {
  /** Where to send the user once Instagram connects (the conversations module). */
  conversationsPath: string;
  /** Auto-redirect to conversations a few seconds after connecting. */
  autoRedirect?: boolean;
  /** Which linked account this widget manages (1 = first account). */
  slot?: number;
  /** Optional heading shown above the widget (e.g. "Account 2 · Support"). */
  title?: string;
  /** Called after a successful logout so a parent list can refresh. */
  onChanged?: () => void;
};

const POLL_MS = 2000;
const REDIRECT_DELAY_MS = 2500;

const STATUS_LABEL: Record<InstagramDmStatus, string> = {
  unlinked: "Not connected",
  connecting: "Connecting…",
  awaiting_2fa: "Enter 2FA code",
  awaiting_challenge: "Security checkpoint required",
  connected: "Connected",
  disconnected: "Disconnected",
  logged_out: "Logged out — reconnect needed",
  banned: "Account restricted",
};

export function InstagramConnect({ conversationsPath, autoRedirect = true, slot = 1, title, onChanged }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<InstagramDmStatus>("unlinked");
  const [igUsername, setIgUsername] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // `allowRedirect` is true only while an active connect flow is running.
  // The initial status load passes false, so revisiting an already-connected
  // settings screen never auto-redirects — only a fresh connect does.
  const apply = useCallback(
    (
      s: { status: InstagramDmStatus; ig_username?: string | null; last_error?: string | null },
      allowRedirect = false
    ) => {
      setStatus(s.status);
      if (s.ig_username !== undefined) setIgUsername(s.ig_username ?? null);
      setLastError(s.last_error ?? null);
      if (s.status === "connected") {
        stopPolling();
        notifyIntegrationsChanged(); // refresh the connection banner immediately
        setPassword("");
        setCode("");
        if (allowRedirect && autoRedirect && !redirectedRef.current) {
          redirectedRef.current = true;
          setTimeout(() => router.push(conversationsPath), REDIRECT_DELAY_MS);
        }
      }
      if (s.status !== "connecting" && s.status !== "awaiting_2fa" && s.status !== "awaiting_challenge") {
        stopPolling();
      }
    },
    [autoRedirect, conversationsPath, router, stopPolling]
  );

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await instagramDmService.status(slot);
        apply(s, true); // polling only runs after a Connect click → redirect allowed
      } catch {
        /* transient — keep polling */
      }
    }, POLL_MS);
  }, [apply, stopPolling, slot]);

  // Initial status load — never redirects (allowRedirect defaults to false).
  // A failure here just means "treat as not connected yet" — don't show a
  // scary error banner on a page a fresh/never-linked tenant is expected to land on.
  useEffect(() => {
    let alive = true;
    instagramDmService
      .status(slot)
      .then((s) => alive && apply(s))
      .catch(() => alive && setStatus("unlinked"));
    return () => {
      alive = false;
      stopPolling();
    };
  }, [apply, stopPolling, slot]);

  const handleConnect = async () => {
    if (!username.trim() || !password) {
      setError("Enter both the Instagram username and password.");
      return;
    }
    setBusy(true);
    setError(null);
    redirectedRef.current = false;
    try {
      const s = await instagramDmService.connect(username.trim(), password, slot);
      apply(s, true);
      startPolling();
    } catch {
      setError("Failed to start Instagram login. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!code.trim()) {
      setError("Enter the verification code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await instagramDmService.submitCode(code.trim(), slot);
      apply(s, true);
      if (s.status === "awaiting_2fa" || s.status === "awaiting_challenge") {
        // still not done — keep the code step open
      } else {
        startPolling();
      }
    } catch {
      setError("Failed to verify code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await instagramDmService.logout(slot);
      stopPolling();
      setStatus("unlinked");
      setIgUsername(null);
      setLastError(null);
      setUsername("");
      setPassword("");
      setCode("");
      notifyIntegrationsChanged(); // show the "not connected" banner immediately
      onChanged?.();
    } catch {
      setError("Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const isConnected = status === "connected";
  const isBanned = status === "banned";
  const needsCode = status === "awaiting_2fa" || status === "awaiting_challenge";
  const isConnecting = status === "connecting";

  return (
    <div className="space-y-4">
      {title && <h4 className="text-[13px] font-semibold text-slate-800">{title}</h4>}

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Status</span>
        <Tag color={isConnected ? "green" : isBanned ? "red" : needsCode ? "orange" : status === "logged_out" ? "red" : "default"}>
          {STATUS_LABEL[status]}
        </Tag>
        {igUsername && <span className="font-mono text-xs text-slate-400">@{igUsername}</span>}
      </div>

      {error && <Alert type="error" message={error} showIcon />}
      {!error && lastError && <Alert type="warning" message={lastError} showIcon />}

      {isConnected ? (
        <Alert
          type="success"
          showIcon
          message="Instagram is connected"
          description={
            <div className="space-y-2">
              <p className="text-sm">
                Incoming DMs now appear in your Conversations inbox and the AI replies
                automatically.
                {autoRedirect && " Redirecting you to Conversations…"}
              </p>
              <Button type="primary" size="small" onClick={() => router.push(conversationsPath)}>
                Go to Conversations
              </Button>
            </div>
          }
        />
      ) : isBanned ? (
        <Alert
          type="error"
          showIcon
          message="Instagram restricted this account"
          description="Instagram has flagged, checkpointed, or restricted this account. Reconnecting is unlikely to succeed until the restriction clears on Instagram's side. Consider using a different account, or disconnect and try again later."
        />
      ) : needsCode ? (
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound size={16} className="text-pink-600" />
            <p className="text-sm text-slate-600">
              {status === "awaiting_2fa"
                ? "Instagram requires a two-factor authentication code. Enter the code sent to the account."
                : "Instagram requires a security checkpoint. Enter the confirmation code Instagram sent (or approve the login in the Instagram app first, then enter the code)."}
            </p>
          </div>
          <Form layout="vertical" onFinish={() => void handleSubmitCode()}>
            <Form.Item label="Verification code" className="!mb-3">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code"
                maxLength={10}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>
              Submit code
            </Button>
          </Form>
        </div>
      ) : isConnecting ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8">
          <Spin />
          <p className="text-xs text-slate-500">Signing in to Instagram…</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Instagram size={16} className="text-pink-600" />
            <p className="text-sm text-slate-600">
              Link the clinic&apos;s Instagram account with its username and password — no
              Meta API setup required.
            </p>
          </div>
          <Form layout="vertical" onFinish={() => void handleConnect()}>
            <Form.Item label="Instagram username" className="!mb-3">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="clinic_handle"
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item label="Instagram password" className="!mb-3">
              <Input.Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="off"
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={busy}>
              {status === "logged_out" || status === "disconnected"
                ? "Reconnect Instagram"
                : "Connect Instagram"}
            </Button>
          </Form>
        </div>
      )}

      {isConnected && (
        <Button danger size="small" icon={<LogOut size={13} />} loading={busy} onClick={() => void handleLogout()}>
          Disconnect Instagram
        </Button>
      )}

      {(isBanned || status === "logged_out") && (
        <Button size="small" icon={<LogOut size={13} />} loading={busy} onClick={() => void handleLogout()}>
          Clear session
        </Button>
      )}
    </div>
  );
}

export default InstagramConnect;
