const router = require("express").Router();
const webhookCtrl = require("../controllers/webhookController");

// ⚠️ Meta webhook integration removed (connection-flow change).
// These endpoints remain wired so a NEW connection flow can reuse the paths,
// but the handlers currently respond 501 Not Implemented. Re-implement the
// controller handlers when the new inbound transport is defined.
router.get("/whatsapp",  webhookCtrl.whatsappVerify);
router.post("/whatsapp", webhookCtrl.whatsappReceive);

router.get("/instagram",  webhookCtrl.instagramVerify);
router.post("/instagram", webhookCtrl.instagramReceive);

module.exports = router;
