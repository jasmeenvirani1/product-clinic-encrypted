const router = require("express").Router();
const leadCtrl = require("../controllers/leadController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

// Teammates list — no separate permission required, just auth
// Must be defined before /:id to avoid route conflict
router.get("/teammates", leadCtrl.getTeammates);

router.get("/",                              checkPermission("app-leads", "view"),   leadCtrl.getAll);
router.get("/:id",                           checkPermission("app-leads", "view"),   leadCtrl.getById);
router.post("/",                             checkPermission("app-leads", "create"), leadCtrl.create);
router.put("/:id",                           checkPermission("app-leads", "edit"),   leadCtrl.update);
router.delete("/:id",                        checkPermission("app-leads", "delete"), leadCtrl.remove);
router.get("/:id/summaries",                 checkPermission("app-leads", "view"),   leadCtrl.getSummaries);
router.post("/:id/summary/regenerate",       checkPermission("app-leads", "view"),   leadCtrl.regenerateSummary);

module.exports = router;
