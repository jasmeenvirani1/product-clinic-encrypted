const router = require("express").Router();
const role = require("../controllers/roleController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.post("/", checkPermission("roles", "create"), role.create);
router.get("/", checkPermission("roles", "view"), role.getAll);
router.get("/:id", checkPermission("roles", "view"), role.getById);
router.put("/:id", checkPermission("roles", "edit"), role.update);
router.delete("/:id", checkPermission("roles", "delete"), role.remove);
router.post("/:id/permissions", checkPermission("roles", "edit"), role.assignPermissions);

module.exports = router;
