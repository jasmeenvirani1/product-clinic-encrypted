const router = require("express").Router();
const webhookCtrl = require("../controllers/webhookController");

// ⚠️ WhatsApp Meta webhook remains removed — WhatsApp uses the self-hosted
// Baileys/QR transport instead (see whatsappQrBootstrap.js). These two
// endpoints stay wired in case a future connection flow needs them.
router.get("/whatsapp",  webhookCtrl.whatsappVerify);
router.post("/whatsapp", webhookCtrl.whatsappReceive);

// Instagram — per-tenant Meta Graph API webhook (verification handshake +
// inbound message delivery). Each clinic brings their OWN Meta App, so the
// URL path itself identifies which tenant's row to use (:tenantId/:slot) —
// there is no shared/global webhook endpoint anymore. POST relies on
// `req.rawBody` (captured in index.js's express.json({ verify }) config) for
// X-Hub-Signature-256 checks, verified against THAT tenant's own app secret.
router.get("/instagram/:tenantId/:slot",  webhookCtrl.instagramVerify);
router.post("/instagram/:tenantId/:slot", webhookCtrl.instagramReceive);

module.exports = router;
