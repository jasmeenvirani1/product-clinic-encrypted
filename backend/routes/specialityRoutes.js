const router = require("express").Router();
const speciality = require("../controllers/specialityController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const specialityImageUpload = require("../middleware/specialityImageUpload");

router.use(authenticate);

router.get("/",       checkPermission("sa-specialities", "view"),   speciality.getAll);
router.get("/:id",    checkPermission("sa-specialities", "view"),   speciality.getById);
router.post("/",      checkPermission("sa-specialities", "create"), speciality.create);
router.put("/:id",    checkPermission("sa-specialities", "edit"),   speciality.update);
router.delete("/:id", checkPermission("sa-specialities", "delete"), speciality.remove);

router.post(
  "/upload-image",
  checkPermission("sa-specialities", "create"),
  specialityImageUpload,
  speciality.uploadDetailImage
);

module.exports = router;
