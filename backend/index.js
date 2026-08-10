require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { sequelize } = require("./models");
const { APP_NAME } = require("./constants/brand");
const paymentHistoryController = require("./controllers/paymentHistoryController");
const { processFollowups } = require("./services/followupService");

const app = express();

// Stripe webhook must be registered before express.json() to keep raw body for signature verification
app.post(
  "/api/payment-history/stripe/webhook",
  express.raw({ type: "application/json" }),
  paymentHistoryController.stripeWebhook
);

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);
// Capture the raw request body alongside JSON parsing so Meta's Instagram
// webhook (POST /api/webhooks/instagram) can verify X-Hub-Signature-256
// against the EXACT bytes Meta sent, not a re-serialized JSON object.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Static file serving for uploaded proof documents
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/backend/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/public", require("./routes/publicRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/roles", require("./routes/roleRoutes"));
app.use("/api/menus", require("./routes/menuRoutes"));
app.use("/api/permissions", require("./routes/permissionRoutes"));
app.use("/api/logs", require("./routes/logRoutes"));
app.use("/api/leads", require("./routes/leadRoutes"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/plans", require("./routes/planRoutes"));
app.use("/api/payment-history", require("./routes/paymentHistoryRoutes"));
app.use("/api/super-admin", require("./routes/superAdminBillingRoutes"));
app.use("/api/videos", require("./routes/videoRoutes"));
app.use("/api/tenant/dashboard", require("./routes/tenantDashboardRoutes"));
app.use("/api/campaigns", require("./routes/campaignRoutes"));
app.use("/api/conversations", require("./routes/conversationRoutes"));
app.use("/api/ai-settings", require("./routes/aiSettingRoutes"));
app.use("/api/super-admin/ai-settings", require("./routes/superAdminAiSettingRoutes"));
app.use("/api/webhooks",   require("./routes/webhookRoutes"));
app.use("/api/faqs",       require("./routes/faqRoutes"));
app.use("/api/manage-pages", require("./routes/managePageRoutes"));
app.use("/api/won-leads",    require("./routes/wonLeadsRoutes"));
app.use("/api/super-admin/theme",         require("./routes/themeRoutes"));
app.use("/api/super-admin/custom-fields", require("./routes/customFieldRoutes"));
app.use("/api/field-preferences",          require("./routes/fieldPreferenceRoutes"));
app.use("/api/super-admin/hero-content",   require("./routes/heroContentRoutes"));
app.use("/api/super-admin/landing-faqs",   require("./routes/landingFaqRoutes"));
app.use("/api/super-admin/seo-settings",   require("./routes/seoSettingRoutes"));
app.use("/api/super-admin/specialities",   require("./routes/specialityRoutes"));
app.use("/api/tenant/specialities",        require("./routes/tenantSpecialityRoutes"));
app.use("/api/ai-models",                  require("./routes/aiModelRoutes"));
app.use("/api/super-admin/ai-models",      require("./routes/superAdminAiModelRoutes"));
app.use("/api/lessons",                    require("./routes/lessonRoutes"));
app.use("/api/clinic-schedule",            require("./routes/clinicScheduleRoutes"));
app.use("/api/notifications",              require("./routes/notificationRoutes"));

// WhatsApp-QR channel (Baileys — link the clinic's real WhatsApp by QR scan).
// Registers /api/whatsapp-qr/* and restores linked sessions on boot.
const { authenticate } = require("./middleware/auth");
require("./services/whatsappQrBootstrap").mountWhatsAppQr(app, { authMiddleware: authenticate });

// Instagram channel (Meta Graph API — each clinic brings their OWN Meta
// Developer App and pastes their App ID/App Secret/Access Token/Instagram
// Business Account ID directly; no shared/global Meta App, no OAuth
// redirect through our backend). Registers /api/instagram-meta/* (credential
// entry + generated webhook info) and starts the token health-check job.
// Inbound messages arrive via the per-tenant webhook mounted through
// /api/webhooks/instagram/:tenantId/:slot (see webhookRoutes.js).
require("./services/instagramDmBootstrap").mountInstagramMeta(app, { authMiddleware: authenticate });

// Instagram Reels sync (issue #33) — dedicated periodic job, deliberately
// separate from the DM token-health check above. Populates the InstagramReel
// table (read by the public clinic profile endpoint) from each connected
// tenant's own IG Business Account; reels-scope failures are logged and
// skipped, never flip InstagramSession.status (that field is DM-health-only).
require("./services/instagramReelsSync").startInstagramReelsSync();

// Google Calendar OAuth2 integration — real redirect-based OAuth flow (unlike
// WhatsApp/Instagram above). Registers /api/google/* (authorize/callback/
// status/disconnect). Access/refresh tokens are encrypted at rest via
// backend/utils/tokenCrypto.js — a deliberate deviation from Instagram's
// plaintext-storage precedent (see GoogleConnection.js file header).
require("./services/googleOAuthBootstrap").mountGoogleOAuth(app, { authMiddleware: authenticate });

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: `${APP_NAME} API is running.` });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// Start server
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected.");

    await sequelize.sync({ alter: true });
    console.log("Database synced.");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Run follow-up job immediately on start, then every hour
    void processFollowups();
    setInterval(() => void processFollowups(), 60 * 60 * 1000);
    console.log("Follow-up job scheduled (every 1 hour).");
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
