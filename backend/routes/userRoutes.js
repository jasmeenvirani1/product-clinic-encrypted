const router = require("express").Router();
const userCtrl = require("../controllers/userController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const userProofUpload = require("../middleware/userProofUpload");

// All routes require a valid JWT first.
// super_admin bypasses permission checks automatically.
// tenant_admin has `users` permissions → can manage their own tenant's users.
// staff_user has no `users` permission → receives 403.
router.use(authenticate);

router.get("/tenant-admins", checkPermission("users", "view"), userCtrl.getTenantAdmins);
router.get("/",       checkPermission("users", "view"),   userCtrl.getAll);
router.get("/:id",    checkPermission("users", "view"),   userCtrl.getById);
router.post("/",      checkPermission("users", "create"), userProofUpload, userCtrl.create);
router.put("/:id",    checkPermission("users", "edit"),   userProofUpload, userCtrl.update);
router.delete("/:id/document", checkPermission("users", "edit"),  userCtrl.deleteDocument);
router.delete("/:id",          checkPermission("users", "delete"), userCtrl.remove);

module.exports = router;
