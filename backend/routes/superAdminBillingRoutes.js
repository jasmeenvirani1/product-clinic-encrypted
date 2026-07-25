const router = require("express").Router();
const ctrl = require("../controllers/superAdminBillingController");
const dashboardCtrl = require("../controllers/superAdminDashboardController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/dashboard", checkPermission("sa-dashboard", "view"), dashboardCtrl.getDashboard);
router.get("/payments", checkPermission("sa-payments", "view"), ctrl.getPayments);
router.get("/subscriptions", checkPermission("sa-subscriptions", "view"), ctrl.getSubscriptions);

module.exports = router;
