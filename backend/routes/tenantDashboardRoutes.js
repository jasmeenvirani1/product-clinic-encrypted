const router = require("express").Router();
const ctrl = require("../controllers/tenantDashboardController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/", checkPermission("app-dashboard", "view"), ctrl.getDashboard);

module.exports = router;
