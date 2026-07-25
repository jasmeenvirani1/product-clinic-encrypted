const router = require("express").Router();
const landingFaq = require("../controllers/landingFaqController");
const { authenticate } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.use(authenticate);

router.get("/",       checkPermission("sa-landing-faqs", "view"),   landingFaq.getAll);
router.post("/",      checkPermission("sa-landing-faqs", "create"), landingFaq.create);
router.put("/:id",    checkPermission("sa-landing-faqs", "edit"),   landingFaq.update);
router.delete("/:id", checkPermission("sa-landing-faqs", "delete"), landingFaq.remove);

module.exports = router;
