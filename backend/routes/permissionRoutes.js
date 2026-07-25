const router = require("express").Router();
const permission = require("../controllers/permissionController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.post("/", checkPermission("permissions", "create"), permission.create);
router.get("/", checkPermission("permissions", "view"), permission.getAll);
router.put("/:id", checkPermission("permissions", "edit"), permission.update);
router.delete("/:id", checkPermission("permissions", "delete"), permission.remove);

module.exports = router;
