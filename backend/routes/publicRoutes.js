const router = require("express").Router();
const { Plan } = require("../models");
const managePageController = require("../controllers/managePageController");
const themeController = require("../controllers/themeController");
const customFieldController = require("../controllers/customFieldController");
const heroContentController = require("../controllers/heroContentController");
const videoController = require("../controllers/videoController");
const landingFaqController = require("../controllers/landingFaqController");
const specialityController = require("../controllers/specialityController");
const seoSettingController = require("../controllers/seoSettingController");

router.get("/plans", async (req, res) => {
  try {
    const plans = await Plan.findAll({
      where: { is_deleted: false, is_active: true },
      attributes: ["id", "plan_name", "price", "monthly_price", "yearly_price", "period", "features", "feature_flags"],
      order: [["price", "ASC"]],
    });
    return res.status(200).json({ success: true, data: plans });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

router.get("/pages/footer", managePageController.getFooterPages);
router.get("/pages/:slug", managePageController.getPublicBySlug);

router.get("/theme", themeController.getPublicTheme);
router.get("/custom-fields", customFieldController.getAll);
router.get("/hero-content", heroContentController.getPublic);
router.get("/landing-video", videoController.landingVideo);
router.get("/landing-faqs", landingFaqController.getPublic);
// KNOWN GAP: no subdomain/header-based tenant-detection precedent exists in this
// codebase yet (confirmed: no tenant-resolution logic anywhere in this file).
// These endpoints intentionally serve the GLOBAL master list only. Tenant-aware public
// resolution (e.g. per-clinic public speciality pages) is deferred to the ticket that
// introduces tenant public-site routing generally — do not add partial/guessed tenant
// detection here.
router.get("/specialities", specialityController.getPublic);
router.get("/specialities/:slug", specialityController.getPublicBySlug);
router.get("/seo-settings/:pageKey", seoSettingController.getPublic);

module.exports = router;
