const { hasFeature } = require("../services/planFeatureService");

// Gate a tenant-scoped write route behind a plan feature flag.
// Super-admin bypasses entirely (mirrors checkPermission's super_admin bypass style).
function requireFeature(key) {
  return (req, res, next) => {
    const role = req.user?.Role?.name;
    if (role === "super_admin") return next();
    if (!hasFeature(req.user, key)) {
      return res.status(403).json({
        success: false,
        message: "This feature is not included in your current plan. Please upgrade to unlock it.",
        code: "FEATURE_LOCKED",
        feature: key,
      });
    }
    next();
  };
}

module.exports = { requireFeature };
