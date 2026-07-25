const router = require("express").Router();
const ctrl = require("../controllers/fieldPreferenceController");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/",  ctrl.getPreference);
router.put("/",  ctrl.upsertPreference);

module.exports = router;
