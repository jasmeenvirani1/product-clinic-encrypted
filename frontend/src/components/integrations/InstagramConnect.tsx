"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input, Spin, Tag, Tooltip } from "antd";
import { Instagram, Copy, Check, KeyRound } from "lucide-react";
import {
  instagramMetaService,
  type InstagramMetaStatus,
} from "@/services/aiSetting.service";
import { notifyIntegrationsChanged } from "@/utils/integrationEvents";

type Props = {
  /** Where to send the user once Instagram connects (the conversations module). */
  conversationsPath: string;
  /**
   * Unused in the credentials-entry flow: connection only becomes "connected"
   * once Meta's webhook starts delivering pings after the clinic configures
   * their own Meta App, not immediately on save — so there's no "just
   * connected" moment to auto-redirect from. Kept in the prop shape only for
   * call-site compatibility with the previous OAuth-redirect widget.
   */
  autoRedirect?: boolean;
  /** Which linked account this widget manages (1 = first account). */
  slot?: number;
  /** Optional heading shown above the widget (e.g. "Account 2 · Support"). */
  title?: string;
  /** Called after a successful disconnect so a parent list can refresh. */
  onChanged?: () => void;
};

const STATUS_LABEL: Record<InstagramMetaStatus, string> = {
  disconnected: "Not connected",
  connected: "Connected",
  error: "Connection error",
};

/** Small inline "click to copy" control, following the copy-on-click pattern
 * already used elsewhere in this codebase (see leads table's phone column). */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-slate-700">{value}</span>
        <Tooltip title={copied ? "Copied!" : "Copy"}>
          <Button
            size="small"
            type="text"
            icon={copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            onClick={() => void handleCopy()}
          />
        </Tooltip>
      </div>
    </div>
  );
}

export function InstagramConnect({ conversationsPath, slot = 1, title, onChanged }: Props) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [status, setStatus] = useState<InstagramMetaStatus>("disconnected");
  const [igUsername, setIgUsername] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [appSecretMasked, setAppSecretMasked] = useState<string | null>(null);
  const [accessTokenMasked, setAccessTokenMasked] = useState<string | null>(null);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWebhookInfo = useCallback(async () => {
    try {
      const info = await instagramMetaService.webhookInfo(slot);
      setWebhookUrl(info.webhook_url);
      setVerifyToken(info.verify_token);
    } catch {
      // webhook info is best-effort display — credentials save can still have succeeded
    }
  }, [slot]);

  const loadStatus = useCallback(async () => {
    try {
      const s = await instagramMetaService.status(slot);
      setStatus(s.status);
      setIgUsername(s.ig_username ?? null);
      setLastError(s.last_error ?? null);
      setHasCredentials(!!s.has_credentials);
      setAppSecretMasked(s.meta_app_secret_masked ?? null);
      setAccessTokenMasked(s.access_token_masked ?? null);
      if (s.status === "connected") notifyIntegrationsChanged();
      if (s.has_credentials) await loadWebhookInfo();
    } catch {
      setStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }, [slot, loadWebhookInfo]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSaveCredentials = async () => {
    setError(null);
    try {
      const values = await form.validateFields();
      setBusy(true);
      const s = await instagramMetaService.saveCredentials(
        {
          meta_app_id: values.meta_app_id,
          meta_app_secret: values.meta_app_secret,
          access_token: values.access_token,
          ig_business_account_id: values.ig_business_account_id,
        },
        slot
      );
      setStatus(s.status);
      setIgUsername(s.ig_username ?? null);
      setLastError(s.last_error ?? null);
      setHasCredentials(!!s.has_credentials);
      setAppSecretMasked(s.meta_app_secret_masked ?? null);
      setAccessTokenMasked(s.access_token_masked ?? null);
      form.resetFields(["meta_app_secret", "access_token"]); // never keep secrets in the form after save
      setShowCredentialsForm(false);
      if (s.status === "connected") notifyIntegrationsChanged();
      await loadWebhookInfo();
      onChanged?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) setError(msg);
      // else: Form.validateFields already surfaced field-level errors, nothing extra to show
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await instagramMetaService.disconnect(slot);
      setStatus("disconnected");
      setIgUsername(null);
      setLastError(null);
      setHasCredentials(false);
      setAppSecretMasked(null);
      setAccessTokenMasked(null);
      setWebhookUrl(null);
      setVerifyToken(null);
      form.resetFields();
      notifyIntegrationsChanged();
      onChanged?.();
    } catch {
      setError("Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  };

  const isConnected = status === "connected";
  const hasError = status === "error";

  return (
    <div className="space-y-4">
      {title && <h4 className="text-[13px] font-semibold text-slate-800">{title}</h4>}

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600">Status</span>
        <Tag color={isConnected ? "green" : hasError ? "red" : "default"}>{STATUS_LABEL[status]}</Tag>
        {isConnected && igUsername && <span className="font-mono text-xs text-slate-400">@{igUsername}</span>}
        {isConnected && (
          <Button type="link" size="small" className="!h-auto !px-1 !py-0" onClick={() => router.push(conversationsPath)}>
            Go to Conversations
          </Button>
        )}
      </div>

      {!isConnected && (
        <Alert
          type="info"
          showIcon
          message="You'll need your own Meta Developer App"
          description={
            <div className="space-y-1 text-xs">
              <p>
                This clinic connects Instagram using its own Meta Developer App — not a shared
                MedLeads login. Before entering credentials below, make sure you have:
              </p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>A Meta Developer App with the <strong>Instagram Graph API</strong> product added</li>
                <li>An Instagram <strong>Business or Creator account</strong> linked to a Facebook Page</li>
                <li>A long-lived <strong>Access Token</strong> generated from your Meta App&apos;s dashboard</li>
                <li>
                  To display Reels on your public profile, your Access Token also needs the{" "}
                  <strong>instagram_business_basic</strong> permission (this replaced the older
                  &quot;instagram_basic&quot; scope Meta retired in 2025) — select it in Graph API
                  Explorer when generating your token.
                </li>
              </ul>
              <p>
                After saving your credentials below, we&apos;ll show you a webhook URL and verify token —
                paste those into your Meta App&apos;s webhook settings on developers.facebook.com to start
                receiving DMs.
              </p>
            </div>
          }
        />
      )}

      {error && <Alert type="error" message={error} showIcon />}
      {!error && lastError && <Alert type="warning" message={lastError} showIcon />}

      {loading ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 p-8">
          <Spin />
          <p className="text-xs text-slate-500">Checking connection status…</p>
        </div>
      ) : (
        <>
          {hasCredentials && !showCredentialsForm && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Meta credentials saved</p>
                <p className="text-xs text-slate-500 font-mono">
                  Secret {appSecretMasked ?? "••••••••"} · Token {accessTokenMasked ?? "••••••••"}
                </p>
              </div>
              <Button size="small" onClick={() => setShowCredentialsForm(true)}>
                Update
              </Button>
            </div>
          )}

          {!hasCredentials && !showCredentialsForm && (
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Instagram size={16} className="text-pink-600" />
                <p className="text-sm text-slate-600">
                  Enter your clinic&apos;s Meta App credentials to connect Instagram DMs.
                </p>
              </div>
              <Button type="primary" icon={<KeyRound size={14} />} onClick={() => setShowCredentialsForm(true)}>
                Enter Credentials
              </Button>
            </div>
          )}

          {showCredentialsForm && (
            <Form form={form} layout="vertical" className="crm-form space-y-2">
              <Form.Item
                name="meta_app_id"
                label="Meta App ID"
                rules={[{ required: true, message: "App ID is required." }]}
              >
                <Input placeholder="1234567890123456" />
              </Form.Item>
              <Form.Item
                name="meta_app_secret"
                label="Meta App Secret"
                rules={[{ required: !hasCredentials, message: "App Secret is required." }]}
                extra={hasCredentials ? "Leave blank to keep the currently saved secret." : undefined}
              >
                <Input.Password placeholder="App Secret" />
              </Form.Item>
              <Form.Item
                name="access_token"
                label="Access Token"
                rules={[{ required: !hasCredentials, message: "Access Token is required." }]}
                extra={
                  hasCredentials
                    ? "Leave blank to keep the currently saved token."
                    : "A long-lived token generated from your own Meta App's dashboard."
                }
              >
                <Input.Password placeholder="Access Token" />
              </Form.Item>
              <Form.Item
                name="ig_business_account_id"
                label="Instagram Business Account ID"
                rules={[{ required: !hasCredentials, message: "Instagram Business Account ID is required." }]}
                extra={hasCredentials ? undefined : "Find this in your Meta App's Graph API Explorer or your Facebook Page's linked Instagram account settings."}
              >
                <Input placeholder="17841400000000000" />
              </Form.Item>
              <div className="flex gap-2">
                <Button type="primary" loading={busy} onClick={() => void handleSaveCredentials()}>
                  Save Credentials
                </Button>
                {hasCredentials && (
                  <Button onClick={() => setShowCredentialsForm(false)} disabled={busy}>
                    Cancel
                  </Button>
                )}
              </div>
            </Form>
          )}

          {hasCredentials && (webhookUrl || verifyToken) && (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-5">
              <p className="text-xs font-medium text-slate-600">
                Paste these into your Meta App&apos;s webhook configuration on developers.facebook.com:
              </p>
              {webhookUrl && <CopyField label="Callback / Webhook URL" value={webhookUrl} />}
              {verifyToken && <CopyField label="Verify Token" value={verifyToken} />}
            </div>
          )}

          {hasCredentials && (
            <Button danger size="small" loading={busy} onClick={() => void handleDisconnect()}>
              Disconnect Instagram
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default InstagramConnect;
