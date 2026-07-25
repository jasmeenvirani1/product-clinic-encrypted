const router = require("express").Router();
const { Plan } = require("../models");
const managePageController = require("../controllers/managePageController");
const themeController = require("../controllers/themeController");
const customFieldController = require("../controllers/customFieldController");
const heroContentController = require("../controllers/heroContentController");
const videoController = require("../controllers/videoController");
const landingFaqController = require("../controllers/landingFaqController");

router.get("/plans", async (req, res) => {
  try {
    const plans = await Plan.findAll({
      where: { is_deleted: false, is_active: true },
      attributes: ["id", "plan_name", "price", "monthly_price", "yearly_price", "period", "campaign_count", "features"],
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

module.exports = router;
