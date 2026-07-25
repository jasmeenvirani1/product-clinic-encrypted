const router = require("express").Router();
const aiModel = require("../controllers/aiModelController");
const { authenticate } = require("../middleware/auth");

// Shared read-only list of active AI models, used to populate the model dropdown
// in both super-admin and tenant AI settings. Any authenticated user may read it.
router.use(authenticate);
router.get("/", aiModel.listActive);

module.exports = router;
