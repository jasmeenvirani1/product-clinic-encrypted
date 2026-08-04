const nodemailer = require("nodemailer");
const { APP_NAME, COLORS } = require("../constants/brand");
const log = require("./logger");

const MODULE = "Mailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(to, otp, purpose) {
  const subjects = {
    registration: "Email Verification OTP",
    login: "Login OTP",
    password_reset: "Password Reset OTP",
  };

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: subjects[purpose] || "Your OTP Code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#1a73e8;margin-bottom:16px;">${APP_NAME}</h2>
        <p>Your OTP for <strong>${purpose.replace("_", " ")}</strong> is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f5f5f5;border-radius:4px;margin:16px 0;">
          ${otp}
        </div>
        <p style="color:#666;font-size:13px;">This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}

// Escapes the 5 HTML-significant characters, including BOTH quote styles — so
// output is safe in text content and inside a double-quoted attribute value
// (the template uses it in href="mailto:..." / href="tel:..."). It is NOT
// sufficient for unquoted attributes, javascript:/data: URLs, or <script>/<style>
// bodies; do not use it in those contexts without a URL-specific encoder.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendCustomPlanEnquiryEmail({ name, mobile, email, message }) {
  if (!process.env.SALES_EMAIL) {
    log.error(MODULE, "sendCustomPlanEnquiryEmail", { error: "SALES_EMAIL is not configured" });
    throw new Error("SALES_EMAIL is not configured");
  }

  // Email HTML is deliberately old-fashioned: nested tables, inline styles only,
  // no flexbox/grid/classes. Outlook renders via Word's engine and silently drops
  // modern CSS, so a table layout is the only reliable option.
  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

  // One row per detail. `mono` is for values that benefit from alignment (phone
  // numbers); `href` turns the value into a real link so mail clients don't
  // guess. Escape happens here so callers can't forget it.
  const detailRow = (label, value, { href = null, last = false } = {}) => {
    const border = last ? "" : `border-bottom:1px solid ${COLORS.surfaceBorder};`;
    const safe = escapeHtml(value);
    const rendered = href
      ? `<a href="${href}${safe}" style="color:${COLORS.primary};text-decoration:none;font-weight:500;">${safe}</a>`
      : `<span style="color:${COLORS.textHeading};font-weight:500;">${safe}</span>`;
    return `
              <tr>
                <td style="padding:14px 0;${border}font-family:${FONT};font-size:12px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.5px;width:110px;vertical-align:top;">${label}</td>
                <td style="padding:14px 0;${border}font-family:${FONT};font-size:15px;line-height:1.5;">${rendered}</td>
              </tr>`;
  };

  // Escape FIRST, then turn newlines into <br> — the other order would escape
  // the tags we just inserted. Rendered as its own panel rather than a table row
  // because free text can run long and reads better full-width.
  const messageBlock = message
    ? `
          <tr>
            <td style="padding:0 32px 28px;">
              <div style="font-family:${FONT};font-size:12px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Requirement</div>
              <div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${COLORS.textBody};background:${COLORS.surface};border:1px solid ${COLORS.surfaceBorder};border-radius:8px;padding:16px;">${escapeHtml(message).replace(/\r?\n/g, "<br>")}</div>
            </td>
          </tr>`
    : "";

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.SALES_EMAIL,
    replyTo: email,
    subject: `New custom plan enquiry — ${name}`,
    // Plain-text alternative: some clients and most spam filters want one, and
    // a missing text/plain part measurably hurts deliverability.
    text: [
      `New custom plan enquiry from the ${APP_NAME} landing page.`,
      ``,
      `Name:   ${name}`,
      `Mobile: ${mobile}`,
      `Email:  ${email}`,
      ...(message ? [``, `Requirement:`, message] : []),
      ``,
      `Reply to this email to reach ${name} directly.`,
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New custom plan enquiry</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bgPage};">
  <!-- Preheader: the grey snippet shown next to the subject in most inboxes.
       Hidden in the body itself so it never renders twice. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(name)} · ${escapeHtml(mobile)} · ${escapeHtml(email)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bgPage};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${COLORS.white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">

          <!-- Brand bar -->
          <tr>
            <td style="background:${COLORS.primaryDeep};padding:20px 32px;">
              <span style="font-family:${FONT};font-size:17px;font-weight:700;color:${COLORS.white};letter-spacing:-0.2px;">${APP_NAME}</span>
              <span style="font-family:${FONT};font-size:12px;color:rgba(255,255,255,0.65);float:right;padding-top:5px;">Sales notification</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:28px 32px 4px;">
              <h1 style="margin:0 0 6px;font-family:${FONT};font-size:20px;font-weight:600;color:${COLORS.textHeading};">New custom plan enquiry</h1>
              <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${COLORS.textMuted};">
                Submitted from the landing page pricing section.
              </p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:20px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${detailRow("Name", name)}
                ${detailRow("Mobile", mobile, { href: "tel:" })}
                ${detailRow("Email", email, { href: "mailto:", last: !message })}
              </table>
            </td>
          </tr>
${messageBlock}
          <!-- Primary action -->
          <tr>
            <td style="padding:0 32px 28px;">
              <a href="mailto:${escapeHtml(email)}"
                 style="display:inline-block;background:${COLORS.primary};color:${COLORS.white};font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
                Reply to ${escapeHtml(name)}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px;background:${COLORS.surface};border-top:1px solid ${COLORS.surfaceBorder};">
              <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.textMuted2};">
                Replying to this email reaches the enquirer directly. Sent automatically by ${APP_NAME}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}

module.exports = { sendOtpEmail, sendCustomPlanEnquiryEmail };
