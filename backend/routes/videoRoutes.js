const router = require("express").Router();
const ctrl = require("../controllers/videoController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const videoUpload = require("../middleware/videoUpload");

router.use(authenticate);

router.get("/guide", checkPermission("app-guide", "view"), ctrl.guide);
// Authenticated lookup of a single video by its associated menu slug.
// No special permission gate — any signed-in non-staff user may surface the
// help video for the page they're currently on. The handler returns null
// when no video is associated, so it is safe to call broadly.
router.get("/by-menu/:slug", ctrl.byMenuSlug);
router.get("/", checkPermission("sa-videos", "view"), ctrl.getAll);
router.get("/:id", checkPermission("sa-videos", "view"), ctrl.getById);
router.post("/", checkPermission("sa-videos", "create"), videoUpload, ctrl.create);
router.put("/:id", checkPermission("sa-videos", "edit"), videoUpload, ctrl.update);
router.delete("/:id", checkPermission("sa-videos", "delete"), ctrl.remove);

module.exports = router;
