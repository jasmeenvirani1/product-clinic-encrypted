const router = require("express").Router();
const aiModel = require("../controllers/aiModelController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/",       checkPermission("sa-ai-models", "view"),   aiModel.getAll);
router.post("/",      checkPermission("sa-ai-models", "create"), aiModel.create);
router.put("/:id",    checkPermission("sa-ai-models", "edit"),   aiModel.update);
router.delete("/:id", checkPermission("sa-ai-models", "delete"), aiModel.remove);

module.exports = router;
