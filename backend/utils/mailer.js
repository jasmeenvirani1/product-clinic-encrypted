const nodemailer = require("nodemailer");
const { APP_NAME } = require("../constants/brand");

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

module.exports = { sendOtpEmail };
