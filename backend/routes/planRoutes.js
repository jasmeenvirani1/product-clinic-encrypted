const router = require("express").Router();
const plan = require("../controllers/planController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.post("/", checkPermission("plans", "create"), plan.create);
router.get("/", checkPermission("plans", "view"), plan.getAll);
router.get("/:id", checkPermission("plans", "view"), plan.getById);
router.put("/:id", checkPermission("plans", "edit"), plan.update);
router.delete("/:id", checkPermission("plans", "delete"), plan.remove);

module.exports = router;
