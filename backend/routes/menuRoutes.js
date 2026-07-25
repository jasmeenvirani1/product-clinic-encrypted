const router = require("express").Router();
const menu = require("../controllers/menuController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.post("/", checkPermission("menus", "create"), menu.create);
router.get("/", checkPermission("menus", "view"), menu.getAll);
router.get("/flat", checkPermission("menus", "view"), menu.getAllFlat);
router.put("/:id", checkPermission("menus", "edit"), menu.update);
router.delete("/:id", checkPermission("menus", "delete"), menu.remove);

module.exports = router;
