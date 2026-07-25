const router = require("express").Router();
const heroContent = require("../controllers/heroContentController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/", checkPermission("sa-hero-content", "view"), heroContent.getAdmin);
router.put("/", checkPermission("sa-hero-content", "edit"), heroContent.update);

module.exports = router;
