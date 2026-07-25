const router = require("express").Router();
const ctrl = require("../controllers/themeController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.getTheme);
router.put("/", ctrl.updateTheme);
router.post("/reset", ctrl.resetTheme);

module.exports = router;
