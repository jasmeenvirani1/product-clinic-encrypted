const router = require("express").Router();
const seoSetting = require("../controllers/seoSettingController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/",       checkPermission("sa-seo-settings", "view"),   seoSetting.getAll);
router.post("/",      checkPermission("sa-seo-settings", "create"), seoSetting.create);
router.put("/:id",    checkPermission("sa-seo-settings", "edit"),   seoSetting.update);
router.delete("/:id", checkPermission("sa-seo-settings", "delete"), seoSetting.remove);

module.exports = router;
