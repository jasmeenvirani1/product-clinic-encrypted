const log = require("../utils/logger");
const { createRateLimiter } = require("../utils/rateLimiter");
const { sendCustomPlanEnquiryEmail } = require("../utils/mailer");

const MODULE = "CustomPlanEnquiryController";

const NAME_MAX = 100;
const MOBILE_MAX = 20;
const EMAIL_MAX = 150;
const MOBILE_REGEX = /^[+]?[0-9][0-9\s\-()]{5,19}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 5 requests / 10 min / IP — generous for real visitors, painful for scripts.
const isAllowed = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

// POST /api/public/custom-plan-enquiry — public (no auth). Validates input
// independently of the client, rate-limits per IP, and emails the enquiry
// to process.env.SALES_EMAIL via the mailer.
exports.submit = async (req, res) => {
  try {
    // KNOWN GAP (flagged by architect): req.ip resolves from the socket
    // unless `app.set("trust proxy", ...)` is configured, which it is not
    // anywhere in this codebase today. If this app sits behind a reverse
    // proxy/load balancer in production, req.ip will return the proxy's
    // own IP for every request, collapsing all visitors into one rate-limit
    // bucket. Out of scope for this ticket — infra-wide decision.
    const clientIp = req.ip;

    const body = req.body && typeof req.body === "object" ? req.body : {};
    let { name, mobile, email } = body;

    if (typeof name !== "string" || typeof mobile !== "string" || typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Name, mobile number and email are required.",
      });
    }

    name = name.trim();
    mobile = mobile.trim();
    email = email.trim();

    if (!name || !mobile || !email) {
      return res.status(400).json({
        success: false,
        message: "Name, mobile number and email are required.",
      });
    }

    if (name.length > NAME_MAX) {
      return res.status(400).json({ success: false, message: "Name is too long." });
    }
    if (mobile.length > MOBILE_MAX) {
      return res.status(400).json({ success: false, message: "Mobile number is too long." });
    }
    if (email.length > EMAIL_MAX) {
      return res.status(400).json({ success: false, message: "Email is too long." });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (!MOBILE_REGEX.test(mobile)) {
      return res.status(400).json({ success: false, message: "Please enter a valid mobile number." });
    }

    // Rate-limit AFTER validation, immediately before the send. The quota
    // exists to cap outbound mail, so only requests that would actually send
    // consume it — otherwise a visitor who mistypes their email a few times
    // burns their own allowance and gets locked out of a form they never
    // successfully submitted.
    if (!isAllowed(clientIp)) {
      log.warn(MODULE, "submit", { error: "rate_limited", ip: clientIp });
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again in a few minutes.",
      });
    }

    await sendCustomPlanEnquiryEmail({ name, mobile, email });

    log.info(MODULE, "submit", { ip: clientIp, email });
    return res.status(200).json({
      success: true,
      message: "Enquiry submitted. Our team will reach out shortly.",
    });
  } catch (err) {
    log.error(MODULE, "submit", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Unable to submit enquiry right now. Please try again later.",
    });
  }
};
