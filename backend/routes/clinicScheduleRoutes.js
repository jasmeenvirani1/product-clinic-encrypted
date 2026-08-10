const router = require("express").Router();
const ctrl = require("../controllers/clinicScheduleController");
const { authenticate } = require("../middleware/auth");

// authenticate-only — no checkPermission, mirrors aiModelRoutes.js's
// precedent for a brand-new settings route with no corresponding
// Menu/Permission row. Role-gating for the write path (tenant_admin /
// super_admin only) is enforced inline in the controller instead.
router.use(authenticate);

router.get("/", ctrl.get);
router.put("/", ctrl.update);

module.exports = router;
