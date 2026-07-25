const router = require("express").Router();
const ctrl = require("../controllers/customFieldController");
const { authenticate } = require("../middleware/auth");

// super_admin only — permission.js skips all checks for super_admin automatically
router.use(authenticate);

router.get("/",      ctrl.getAll);
router.post("/",     ctrl.create);
router.put("/:id",   ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
