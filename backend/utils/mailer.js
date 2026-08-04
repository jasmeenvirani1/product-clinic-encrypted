const nodemailer = require("nodemailer");
const { APP_NAME } = require("../constants/brand");
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

// Escapes the 5 HTML-significant characters. Sufficient because these three
// values are only ever interpolated into HTML *text content* (never into an
// attribute, href, or <script> context) in the email template below.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendCustomPlanEnquiryEmail({ name, mobile, email }) {
  if (!process.env.SALES_EMAIL) {
    log.error(MODULE, "sendCustomPlanEnquiryEmail", { error: "SALES_EMAIL is not configured" });
    throw new Error("SALES_EMAIL is not configured");
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.SALES_EMAIL,
    replyTo: email,
    subject: `${APP_NAME} — New Custom Plan Enquiry`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px;">
        <h2 style="color:#1a73e8;margin-bottom:16px;">${APP_NAME}</h2>
        <p>A new <strong>Custom Plan Enquiry</strong> was submitted from the landing page:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr>
            <td style="padding:8px 0;color:#666;font-size:13px;width:100px;">Name</td>
            <td style="padding:8px 0;font-size:14px;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:13px;">Mobile</td>
            <td style="padding:8px 0;font-size:14px;">${escapeHtml(mobile)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#666;font-size:13px;">Email</td>
            <td style="padding:8px 0;font-size:14px;">${escapeHtml(email)}</td>
          </tr>
        </table>
        <p style="color:#666;font-size:13px;">Reply directly to this email to reach the enquirer.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail, sendCustomPlanEnquiryEmail };
