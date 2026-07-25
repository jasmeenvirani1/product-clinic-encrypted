const router = require("express").Router();
const ctrl = require("../controllers/conversationController");
const { authenticate, requireActivePlan } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);
router.use(requireActivePlan);

router.get("/",                     checkPermission("app-conversations", "view"),   ctrl.getAll);
router.post("/",                    checkPermission("app-conversations", "create"), ctrl.create);
router.get("/:id/messages",         checkPermission("app-conversations", "view"),   ctrl.getMessages);
router.post("/:id/messages",        checkPermission("app-conversations", "create"), ctrl.sendMessage);
router.put("/:id/toggle-ai",        checkPermission("app-conversations", "edit"),   ctrl.toggleAI);
router.put("/:id/status",           checkPermission("app-conversations", "edit"),   ctrl.updateStatus);
router.put("/:id/mark-read",        checkPermission("app-conversations", "edit"),   ctrl.markRead);

module.exports = router;
