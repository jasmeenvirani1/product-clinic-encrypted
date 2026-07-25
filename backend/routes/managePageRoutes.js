const router = require("express").Router();
const managePage = require("../controllers/managePageController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/", checkPermission("sa-manage-pages", "view"), managePage.getAll);
router.post("/", checkPermission("sa-manage-pages", "create"), managePage.create);
router.put("/:id", checkPermission("sa-manage-pages", "edit"), managePage.update);
router.delete("/:id", checkPermission("sa-manage-pages", "delete"), managePage.remove);

module.exports = router;
