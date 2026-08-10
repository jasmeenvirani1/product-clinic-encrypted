const router = require("express").Router();
const speciality = require("../controllers/specialityController");
const { authenticate } = require("../middleware/auth");
const { requireFeature } = require("../middleware/feature");
const specialityImageUpload = require("../middleware/specialityImageUpload");

router.use(authenticate);

router.get("/",         speciality.getTenantList); // no feature gate — read-only, drives the locked/unlocked UI itself
router.post("/",        requireFeature("specialities"), speciality.createOverride);
router.put("/:slug",    requireFeature("specialities"), speciality.updateOverride);
router.delete("/:slug", requireFeature("specialities"), speciality.revertOverride);

router.post(
  "/upload-image",
  requireFeature("specialities"),
  specialityImageUpload,
  speciality.uploadDetailImage
);

module.exports = router;
