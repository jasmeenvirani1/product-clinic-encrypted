const router = require("express").Router();
const ctrl = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");

// No Menu/Permission row exists for this feature yet — authenticate-only,
// same precedent as aiModelRoutes.js. Ownership scoping (recipient_id /
// recipient_role) happens inside the controller, not via checkPermission.
router.use(authenticate);

router.get("/", ctrl.list);
router.patch("/:id/read", ctrl.markRead);

module.exports = router;
