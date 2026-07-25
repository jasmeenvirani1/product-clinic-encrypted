const router = require("express").Router();
const ctrl = require("../controllers/supportController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const supportUpload = require("../middleware/supportUpload");

router.use(authenticate);

router.get("/",    checkPermission("support", "view"),   ctrl.getAll);
router.get("/:id", checkPermission("support", "view"),   ctrl.getById);
router.post("/",   checkPermission("support", "create"), supportUpload, ctrl.create);
router.put("/:id", checkPermission("support", "edit"),   supportUpload, ctrl.update);
router.delete("/:id", checkPermission("support", "delete"), ctrl.remove);

module.exports = router;
