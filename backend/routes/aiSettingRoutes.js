const router = require("express").Router();
const ctrl = require("../controllers/aiSettingController");
const { authenticate, requireActivePlan } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);
router.use(requireActivePlan);

router.get("/",  checkPermission("app-ai-chat", "view"), ctrl.get);
router.put("/",  checkPermission("app-ai-chat", "edit"), ctrl.update);

module.exports = router;
