const router = require("express").Router();
const campaignCtrl = require("../controllers/campaignController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/preview-audience", checkPermission("app-campaigns", "view"), campaignCtrl.previewAudience);
router.get("/",                 checkPermission("app-campaigns", "view"),   campaignCtrl.getAll);
router.get("/:id",              checkPermission("app-campaigns", "view"),   campaignCtrl.getById);
router.post("/",                checkPermission("app-campaigns", "create"), campaignCtrl.create);
router.put("/:id",              checkPermission("app-campaigns", "edit"),   campaignCtrl.update);
router.post("/:id/send",        checkPermission("app-campaigns", "edit"),   campaignCtrl.send);
router.delete("/:id",           checkPermission("app-campaigns", "delete"), campaignCtrl.remove);

module.exports = router;
