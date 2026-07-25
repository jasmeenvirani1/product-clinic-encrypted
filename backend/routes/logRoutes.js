const router = require("express").Router();
const logCtrl = require("../controllers/logController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/",      checkPermission("logs", "view"), logCtrl.getLogs);
router.get("/dates", checkPermission("logs", "view"), logCtrl.getLogDates);

module.exports = router;
