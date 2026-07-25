const router = require("express").Router();
const ctrl = require("../controllers/superAdminAiSettingController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/defaults", ctrl.getDefaults);
router.put("/defaults", ctrl.updateDefaults);
router.get("/tenants", ctrl.listTenantSettings);

module.exports = router;
