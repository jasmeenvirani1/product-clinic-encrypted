const router = require("express").Router();
const ctrl = require("../controllers/paymentHistoryController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/stripe/config", checkPermission("app-billing", "view"), ctrl.getStripeConfig);
router.post(
  "/stripe/checkout-session",
  checkPermission("app-billing", "create"),
  ctrl.createStripeCheckoutSession
);
router.post(
  "/stripe/confirm-session",
  checkPermission("app-billing", "create"),
  ctrl.confirmStripeCheckoutSession
);

router.post("/", checkPermission("app-billing", "create"), ctrl.create);
router.post("/purchase", checkPermission("app-billing", "create"), ctrl.purchasePlan);
router.get("/", checkPermission("app-billing", "view"), ctrl.getAll);
router.get("/:id", checkPermission("app-billing", "view"), ctrl.getById);
router.put("/:id", checkPermission("app-billing", "edit"), ctrl.update);
router.delete("/:id", checkPermission("app-billing", "delete"), ctrl.remove);

module.exports = router;
