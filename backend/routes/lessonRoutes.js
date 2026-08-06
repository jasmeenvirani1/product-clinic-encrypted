const router = require("express").Router();
const ctrl = require("../controllers/lessonController");
const { authenticate } = require("../middleware/auth");

// Every route below requires a valid Bearer JWT — no checkPermission/
// requireFeature gate, since any authenticated tenant user may manage
// their OWN lessons (matches "clinic can create Lessons" — no separate
// super-admin-only permission concept exists for this resource, unlike
// sa-videos).
router.use(authenticate);

// Must be registered before "/:id" so "reels" isn't parsed as a lesson id.
router.get("/reels/available", ctrl.availableReels);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

router.post("/:id/reels", ctrl.attachReel);
router.delete("/:id/reels/:reelId", ctrl.detachReel);

module.exports = router;
