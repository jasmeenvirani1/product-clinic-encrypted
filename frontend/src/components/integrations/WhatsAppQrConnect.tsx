"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Popconfirm, Spin, Tag, Tooltip } from "antd";
import { MessageCircle, RefreshCw, LogOut, ArrowRight, Trash2 } from "lucide-react";
import {
  whatsappQrService,
  type WhatsAppQrStatus,
} from "@/services/aiSetting.service";
import { notifyIntegrationsChanged } from "@/utils/integrationEvents";

type Props = {
  /** Where to send the user once WhatsApp connects (the conversations module). */
  conversationsPath: string;
  /** Auto-redirect to conversations a few seconds after connecting. */
  autoRedirect?: boolean;
  /** Which linked number this widget manages (1 = first number). */
  slot?: number;
  /** Optional heading shown above the widget (e.g. "Number 2 · Support"). */
  title?: string;
  /** Called after a successful logout so a parent list can refresh. */
  onChanged?: () => void;
  /** Total persisted slots for this tenant — drives the "last card" guard. */
  totalSlotCount?: number;
  /** Called after a successful remove so the parent can drop this card immediately. */
  onRemoved?: (slot: number) => void;
};

const POLL_MS = 2000;
const REDIRECT_DELAY_MS = 2500;

const STATUS_LABEL: Record<WhatsAppQrStatus, string> = {
  unlinked: "Not connected",
  connecting: "Connecting…",
  qr_pending: "Scan the QR code",
  connected: "Connected",
  disconnected: "Disconnected",
  logged_out: "Logged out — re-scan needed",
};

export function WhatsAppQrConnect({
  conversationsPath,
  autoRedirect = true,
  slot = 1,
  title,
  onChanged,
  totalSlotCount,
  onRemoved,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<WhatsAppQrStatus>("unlinked");
  const [qr, setQr] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // `allowRedirect` is true only while an active connect/scan flow is running.
  // The initial status load passes false, so revisiting an already-connected
  // settings screen never auto-redirects — only a fresh scan does.
  const apply = useCallback(
    (
      s: { status: WhatsAppQrStatus; qr?: string | null; number?: string | null },
      allowRedirect = false
    ) => {
      setStatus(s.status);
      setQr(s.qr ?? null);
      if (s.number !== undefined) setNumber(s.number ?? null);
      if (s.status === "connected") {
        stopPolling();
        notifyIntegrationsChanged(); // refresh the connection banner immediately
        if (allowRedirect && autoRedirect && !redirectedRef.current) {
          redirectedRef.current = true;
          setTimeout(() => router.push(conversationsPath), REDIRECT_DELAY_MS);
        }
      }
    },
    [autoRedirect, conversationsPath, router, stopPolling]
  );

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const s = await whatsappQrService.status(slot);
        apply(s, true); // polling only runs after a Connect click → redirect allowed
      } catch {
        /* transient — keep polling */
      }
    }, POLL_MS);
  }, [apply, stopPolling, slot]);

  // Initial status load — never redirects (allowRedirect defaults to false).
  useEffect(() => {
    let alive = true;
    whatsappQrService
      .status(slot)
      .then((s) => alive && apply(s))
      .catch(() => alive && setError("Could not load WhatsApp status."));
    return () => {
      alive = false;
      stopPolling();
    };
  }, [apply, stopPolling, slot]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    redirectedRef.current = false;
    try {
      const s = await whatsappQrService.connect(slot);
      apply(s, true);
      startPolling(); // QR arrives a moment after connect; poll for it + connection
    } catch {
      setError("Failed to start WhatsApp session. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await whatsappQrService.logout(slot);
      stopPolling();
      setStatus("unlinked");
      setQr(null);
      setNumber(null);
      notifyIntegrationsChanged(); // show the "not connected" banner immediately
      onChanged?.();
    } catch {
      setError("Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await whatsappQrService.remove(slot);
      stopPolling();
      setStatus("unlinked");
      setQr(null);
      setNumber(null);
      notifyIntegrationsChanged();
      onChanged?.();
      onRemoved?.(slot);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Failed to remove this WhatsApp number.");
    } finally {
      setBusy(false);
    }
  };

  const isConnected = status === "connected";
  const showQr = status === "qr_pending" && qr;
  const isWorking = status === "connecting" || (status === "qr_pending" && !qr);
  const isLastSlot = (totalSlotCount ?? 0) <= 1;
  const removeDisabled = isConnected || isLastSlot;
  const removeDisabledReason = isConnected
    ? "Disconnect WhatsApp before removing this number."
    : "At least one WhatsApp number must remain";

  return (
    <div className="relative space-y-4">
      {!isConnected && (
        <div className="absolute right-0 top-0">
          <Popconfirm
            title="Remove this WhatsApp number?"
            description="This permanently deletes the slot. You'll need to scan a new QR code to reconnect."
            okText="Remove"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleRemove()}
            disabled={removeDisabled}
          >
            <Tooltip title={removeDisabled ? removeDisabledReason : undefined}>
              <span>
                <Button
                  danger
                  size="small"
                  icon={<Trash2 size={13} />}
                  loading={busy}
                  disabled={removeDisabled}
                >
                  Remove
                </Button>
              </span>
            </Tooltip>
          </Popconfirm>
        </div>
      )}
      {title && <h4 className="text-[13px] font-semibold text-slate-800">{title}</h4>}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Status</span>
        <Tag color={isConnected ? "green" : status === "logged_out" ? "red" : "default"}>
          {STATUS_LABEL[status]}
        </Tag>
        {number && <span className="font-mono text-xs text-slate-400">+{number}</span>}
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {isConnected ? (
        <Alert
          type="success"
          showIcon
          message="WhatsApp is connected"
          description={
            <div className="space-y-2">
              <p className="text-sm">
                Incoming messages now appear in your Conversations inbox and the AI replies
                automatically.
                {autoRedirect && " Redirecting you to Conversations…"}
              </p>
              <Button
                type="primary"
                size="small"
                icon={<ArrowRight size={14} />}
                onClick={() => router.push(conversationsPath)}
              >
                Go to Conversations
              </Button>
            </div>
          }
        />
      ) : showQr ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr as string} alt="WhatsApp QR code" width={240} height={240} />
          <p className="max-w-xs text-center text-xs text-slate-500">
            Open <strong>WhatsApp → Linked devices → Link a device</strong> on the clinic phone and
            scan this code. It refreshes automatically.
          </p>
        </div>
      ) : isWorking ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8">
          <Spin />
          <p className="text-xs text-slate-500">Preparing your QR code…</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle size={16} className="text-green-600" />
            <p className="text-sm text-slate-600">
              Link the clinic&apos;s WhatsApp by scanning a QR code — no Meta API setup required.
            </p>
          </div>
          <Button type="primary" loading={busy} onClick={() => void handleConnect()}>
            {status === "logged_out" || status === "disconnected"
              ? "Reconnect WhatsApp"
              : "Connect WhatsApp"}
          </Button>
        </div>
      )}

      {(showQr || isWorking) && (
        <Button size="small" icon={<RefreshCw size={13} />} loading={busy} onClick={() => void handleConnect()}>
          Refresh QR
        </Button>
      )}

      {isConnected && (
        <Button danger size="small" icon={<LogOut size={13} />} loading={busy} onClick={() => void handleLogout()}>
          Disconnect WhatsApp
        </Button>
      )}
    </div>
  );
}

export default WhatsAppQrConnect;
