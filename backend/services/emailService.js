const nodemailer = require("nodemailer");
const log = require("../utils/logger");
const { APP_NAME, APP_SHORT_NAME, APP_FULL_NAME, COLORS } = require("../constants/brand");

const MODULE = "EmailService";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const INTENT_LABELS = { low: "Low Intent", medium: "Medium Intent", high: "High Intent" };
const INTENT_COLORS = { low: "#6b7280", medium: "#f59e0b", high: "#ef4444" };

function getAppOrigin() {
  return String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Build a deep-link URL into the conversations page that survives the
 * login wall: if the user is already authenticated they land on the
 * conversation directly; otherwise the login page sees `?redirect=…`
 * and pushes them there after a successful sign-in.
 */
function buildConversationDeepLink(conversationId) {
  const origin = getAppOrigin();
  const target = `/app/conversations?conversationId=${encodeURIComponent(conversationId)}`;
  return `${origin}/login?redirect=${encodeURIComponent(target)}`;
}

/**
 * Send email notification when a conversation intent matches tenant's
 * configured email_notify_intents. Includes a one-click "Open
 * conversation" button that respects the login state.
 */
async function sendIntentNotification({ toEmail, intent, leadName, channel, conversationId }) {
  if (!toEmail) return;

  const label = INTENT_LABELS[intent] || intent;
  const color = INTENT_COLORS[intent] || "#333";
  const deepLink = buildConversationDeepLink(conversationId);
  const isHigh = intent === "high";

  try {
    await transporter.sendMail({
      from: `"${APP_FULL_NAME}" <${process.env.SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_SHORT_NAME}] ${label} conversation — ${leadName || "New Lead"}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${label} Alert</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.06)">
        <tr><td style="height:6px;background:linear-gradient(90deg,${color},${color}aa)"></td></tr>
        <tr><td style="padding:30px 36px 0">
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color}1a;color:${color};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${label}</div>
          <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.2;color:#0f172a;letter-spacing:-0.01em">${isHigh ? "Hot lead just messaged you" : "New conversation flagged"}</h1>
          <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
            ${isHigh
              ? `<strong style="color:#0f172a">${leadName || "A patient"}</strong> sent a high-intent message on <strong>${channel || "chat"}</strong>. Jump in before the lead cools off.`
              : `A patient conversation with <strong>${leadName || "a new lead"}</strong> on <strong>${channel || "chat"}</strong> was flagged as <strong>${label}</strong>.`}
          </p>
        </td></tr>
        <tr><td style="padding:22px 36px 0">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
            <tr><td style="padding:14px 16px;font-size:13px;color:#475569"><strong style="color:#0f172a">Lead</strong></td><td style="padding:14px 16px;font-size:13px;color:#0f172a;text-align:right">${leadName || "—"}</td></tr>
            <tr><td style="padding:14px 16px;font-size:13px;color:#475569;border-top:1px solid #e2e8f0"><strong style="color:#0f172a">Channel</strong></td><td style="padding:14px 16px;font-size:13px;color:#0f172a;text-align:right;border-top:1px solid #e2e8f0">${channel || "—"}</td></tr>
            <tr><td style="padding:14px 16px;font-size:13px;color:#475569;border-top:1px solid #e2e8f0"><strong style="color:#0f172a">Intent</strong></td><td style="padding:14px 16px;text-align:right;border-top:1px solid #e2e8f0"><span style="background:${color};color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600">${label}</span></td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:26px 36px 6px">
          <a href="${deepLink}" style="display:inline-block;padding:13px 28px;background:${COLORS.primary};background:linear-gradient(135deg,${COLORS.primary},${COLORS.primaryDeep});color:${COLORS.white};text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;letter-spacing:0.01em;box-shadow:0 6px 14px ${COLORS.primaryGlow}">Open conversation →</a>
        </td></tr>
        <tr><td align="center" style="padding:0 36px 26px">
          <p style="margin:8px 0 0;font-size:11.5px;color:#94a3b8;line-height:1.55">
            Already logged in? You'll land on the chat instantly. Otherwise we'll bring you straight here after sign-in.
          </p>
        </td></tr>
        <tr><td style="padding:14px 36px 26px;border-top:1px dashed #cbd5e1;text-align:center">
          <p style="margin:0;font-size:11px;color:${COLORS.textMuted2}">${APP_FULL_NAME} &middot; You're getting this because intent alerts are enabled in AI Chat Settings.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    log.info(MODULE, "sendIntentNotification", { toEmail, intent, conversationId });
  } catch (err) {
    log.error(MODULE, "sendIntentNotification", { error: err.message, toEmail });
  }
}

/**
 * Send an escalation email to the tenant admin when the chatbot's
 * high-intent capture flow fails to collect the minimum lead details
 * after MAX_ATTEMPTS prompts. The admin can then create / fill in the
 * lead manually using the captured chat context.
 */
async function sendLeadCaptureEscalation({
  toEmail,
  tenantName,
  leadName,
  channel,
  conversationId,
  collected = {},
  missing = [],
  recentMessages = [],
}) {
  if (!toEmail) return;

  const safe = (v) => (v == null || v === "" ? "—" : String(v));
  const detailRows = [
    ["Name", safe(collected.name)],
    ["Phone", safe(collected.phone)],
    ["Email", safe(collected.email)],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7280;width:120px">${k}</td><td style="padding:6px 0;font-weight:600">${v}</td></tr>`
    )
    .join("");

  const messagesHtml = recentMessages
    .map(
      (m) =>
        `<div style="padding:6px 10px;border-radius:6px;background:${m.sender === "patient" ? "#f1f5f9" : "#ecfdf5"};margin-bottom:6px"><strong style="color:#475569;font-size:11px;text-transform:uppercase">${m.sender}</strong><div style="font-size:13px;color:#0f172a">${(m.text || "").replace(/[<>]/g, "")}</div></div>`
    )
    .join("");

  const missingLine =
    missing.length > 0
      ? `<p style="color:#b91c1c;margin:8px 0 0">Still missing after 2 prompts: <strong>${missing.join(", ")}</strong></p>`
      : "";

  const deepLink = buildConversationDeepLink(conversationId);

  try {
    await transporter.sendMail({
      from: `"${APP_FULL_NAME}" <${process.env.SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_SHORT_NAME}] High-intent lead needs manual follow-up — ${leadName || "New Lead"}`,
      html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.06)">
      <tr><td style="height:6px;background:linear-gradient(90deg,${COLORS.error},${COLORS.errorLight})"></td></tr>
      <tr><td style="padding:30px 36px 0">
        <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Action required</div>
        <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.2;color:#0f172a;letter-spacing:-0.01em">Manual lead follow-up needed</h1>
        <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">A patient on <strong style="color:#0f172a">${channel || "chat"}</strong> showed high intent but did not share every detail after two prompts. Review the chat and complete the lead manually.</p>
        ${missingLine}
      </td></tr>
      <tr><td style="padding:22px 36px 0">
        <h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8">Captured details</h3>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:6px 16px">${detailRows}</table>
      </td></tr>
      ${recentMessages.length ? `<tr><td style="padding:18px 36px 0">
        <h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8">Recent chat</h3>
        ${messagesHtml}
      </td></tr>` : ""}
      <tr><td align="center" style="padding:26px 36px 6px">
        <a href="${deepLink}" style="display:inline-block;padding:13px 28px;background:#1F9D8B;background:linear-gradient(135deg,#1F9D8B,#0f6f60);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;box-shadow:0 6px 14px rgba(31,157,139,0.32)">Open conversation →</a>
      </td></tr>
      <tr><td align="center" style="padding:0 36px 24px"><p style="margin:8px 0 0;font-size:11.5px;color:#94a3b8;line-height:1.55">If you're already signed in we'll drop you straight into the chat — otherwise you'll come back here right after sign-in.</p></td></tr>
      <tr><td style="padding:14px 36px 24px;border-top:1px dashed #cbd5e1;text-align:center"><p style="margin:0;font-size:11px;color:${COLORS.textMuted2}">Conversation #${conversationId}${tenantName ? " · " + tenantName : ""} &middot; ${APP_FULL_NAME}</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    });
    log.info(MODULE, "sendLeadCaptureEscalation", { toEmail, conversationId, missing });
  } catch (err) {
    log.error(MODULE, "sendLeadCaptureEscalation", { error: err.message, toEmail });
  }
}

/**
 * Send a "new lead received" email to the tenant admin when the
 * high-intent capture flow successfully collected the minimum lead
 * details from the patient. This is the happy-path counterpart to
 * sendLeadCaptureEscalation.
 */
async function sendNewLeadCreatedEmail({
  toEmail,
  tenantName,
  channel,
  conversationId,
  collected = {},
}) {
  if (!toEmail) return;

  const safe = (v) => (v == null || v === "" ? "—" : String(v));
  const detailRows = [
    ["Name", safe(collected.name)],
    ["Phone", safe(collected.phone)],
    ["Email", safe(collected.email)],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#6b7280;width:120px">${k}</td><td style="padding:6px 0;font-weight:600">${v}</td></tr>`
    )
    .join("");

  try {
    await transporter.sendMail({
      from: `"${APP_FULL_NAME}" <${process.env.SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_SHORT_NAME}] New lead received — ${collected.name || "High-intent patient"}`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:0 auto">
          <h2 style="color:#10b981;margin-bottom:4px">New lead received</h2>
          <p style="color:#374151;margin-top:0">A patient on <strong>${channel || "chat"}</strong> showed high purchase intent and shared their contact details. The lead has been created in your CRM.</p>
          <h3 style="margin:20px 0 6px;font-size:14px;color:#0f172a">Patient details</h3>
          <table style="width:100%;border-collapse:collapse">${detailRows}</table>
          <p style="margin-top:20px;font-size:12px;color:#9ca3af">Conversation #${conversationId}${tenantName ? ` · ${tenantName}` : ""}</p>
        </div>
      `,
    });
    log.info(MODULE, "sendNewLeadCreatedEmail", { toEmail, conversationId });
  } catch (err) {
    log.error(MODULE, "sendNewLeadCreatedEmail", { error: err.message, toEmail });
  }
}

/**
 * Send a credit-usage alert to the tenant admin when their AI reply credits
 * cross a usage threshold (75% / 90% / 100%). Fired by creditAlertService the
 * moment a credit is consumed.
 */
async function sendCreditUsageAlert({ toEmail, percent, creditsUsed, creditLimit, tenantName }) {
  if (!toEmail) return;

  const isOut = percent >= 100;
  const color = isOut ? COLORS.error : percent >= 90 ? "#f59e0b" : "#3b82f6";
  const origin = getAppOrigin();
  const billingLink = `${origin}/login?redirect=${encodeURIComponent("/app/billing")}`;
  const heading = isOut
    ? "AI reply credits exhausted"
    : `You've used ${percent}% of your AI reply credits`;

  try {
    await transporter.sendMail({
      from: `"${APP_FULL_NAME}" <${process.env.SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_SHORT_NAME}] ${isOut ? "AI credits exhausted" : `AI credits at ${percent}%`}`,
      html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.06)">
      <tr><td style="height:6px;background:linear-gradient(90deg,${color},${color}aa)"></td></tr>
      <tr><td style="padding:30px 36px 0">
        <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color}1a;color:${color};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${isOut ? "Action required" : "Heads up"}</div>
        <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.2;color:#0f172a;letter-spacing:-0.01em">${heading}</h1>
        <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
          ${isOut
            ? "Your AI assistant has stopped auto-replying to patients because your credit balance is used up. Top up or upgrade your plan to resume automatic replies."
            : `Your AI assistant is still replying, but you're approaching your limit. You've used <strong>${creditsUsed}</strong> of <strong>${creditLimit}</strong> credits.`}
        </p>
      </td></tr>
      <tr><td align="center" style="padding:26px 36px 6px">
        <a href="${billingLink}" style="display:inline-block;padding:13px 28px;background:${COLORS.primary};background:linear-gradient(135deg,${COLORS.primary},${COLORS.primaryDeep});color:${COLORS.white};text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;letter-spacing:0.01em;box-shadow:0 6px 14px ${COLORS.primaryGlow}">Manage billing →</a>
      </td></tr>
      <tr><td style="padding:14px 36px 26px;border-top:1px dashed #cbd5e1;text-align:center">
        <p style="margin:0;font-size:11px;color:${COLORS.textMuted2}">${APP_FULL_NAME}${tenantName ? " · " + tenantName : ""} &middot; You're getting this because AI reply credits are being tracked on your account.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    });
    log.info(MODULE, "sendCreditUsageAlert", { toEmail, percent });
  } catch (err) {
    log.error(MODULE, "sendCreditUsageAlert", { error: err.message, toEmail });
  }
}

/**
 * Send a super_admin alert when every OpenAI credential candidate (tenant's
 * own key, then the platform fallback key) fails for a WhatsApp/Instagram AI
 * reply. Fired by aiCredentialAlertService, mirroring sendCreditUsageAlert's
 * shape/style. Never throws — logs and returns on failure.
 */
async function sendAICredentialFailureAlert({
  toEmail,
  tenantId,
  tenantName,
  credentialType,
  errorMessage,
  errorStatus,
  channel,
  model,
}) {
  if (!toEmail) return;

  const credentialLabel =
    credentialType === "super_admin_fallback_key" ? "Platform fallback key" : "Tenant's own key";
  const tenantLabel = tenantName || `Tenant #${tenantId}`;
  const origin = getAppOrigin();
  const dashboardLink = `${origin}/login?redirect=${encodeURIComponent("/app/dashboard")}`;
  const timestamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  try {
    await transporter.sendMail({
      from: `"${APP_FULL_NAME}" <${process.env.SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_SHORT_NAME}] OpenAI credential failure — ${tenantLabel}`,
      html: `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 20px rgba(15,23,42,0.06)">
      <tr><td style="height:6px;background:linear-gradient(90deg,${COLORS.error},${COLORS.error}aa)"></td></tr>
      <tr><td style="padding:30px 36px 0">
        <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${COLORS.error}1a;color:${COLORS.error};font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Action required</div>
        <h1 style="margin:14px 0 6px;font-size:22px;line-height:1.2;color:#0f172a;letter-spacing:-0.01em">AI reply failed — OpenAI credential issue</h1>
        <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6">
          Every OpenAI credential candidate failed while generating an AI reply on <strong>${channel || "whatsapp"}</strong>. Patients are receiving the static fallback reply until this is resolved.
        </p>
      </td></tr>
      <tr><td style="padding:20px 36px 0">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 0;color:#94a3b8;width:140px">Tenant</td><td style="padding:6px 0;color:#0f172a;font-weight:600">${tenantLabel}</td></tr>
          <tr><td style="padding:6px 0;color:#94a3b8">Credential</td><td style="padding:6px 0;color:#0f172a;font-weight:600">${credentialLabel}</td></tr>
          ${model ? `<tr><td style="padding:6px 0;color:#94a3b8">Model</td><td style="padding:6px 0;color:#0f172a">${model}</td></tr>` : ""}
          <tr><td style="padding:6px 0;color:#94a3b8;vertical-align:top">Error</td><td style="padding:6px 0;color:#0f172a">${errorMessage || "Unknown error"}${errorStatus ? ` (status ${errorStatus})` : ""}</td></tr>
          <tr><td style="padding:6px 0;color:#94a3b8">When</td><td style="padding:6px 0;color:#0f172a">${timestamp}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:26px 36px 6px">
        <a href="${dashboardLink}" style="display:inline-block;padding:13px 28px;background:${COLORS.primary};background:linear-gradient(135deg,${COLORS.primary},${COLORS.primaryDeep});color:${COLORS.white};text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;letter-spacing:0.01em;box-shadow:0 6px 14px ${COLORS.primaryGlow}">Open dashboard →</a>
      </td></tr>
      <tr><td style="padding:14px 36px 26px;border-top:1px dashed #cbd5e1;text-align:center">
        <p style="margin:0;font-size:11px;color:${COLORS.textMuted2}">${APP_FULL_NAME} &middot; You're getting this because you're a platform super_admin and an OpenAI credential just failed for a clinic's AI replies.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    });
    log.info(MODULE, "sendAICredentialFailureAlert", { toEmail, tenantId, credentialType });
  } catch (err) {
    log.error(MODULE, "sendAICredentialFailureAlert", { error: err.message, toEmail, tenantId });
  }
}

module.exports = {
  sendIntentNotification,
  sendLeadCaptureEscalation,
  sendNewLeadCreatedEmail,
  sendCreditUsageAlert,
  sendAICredentialFailureAlert,
};
