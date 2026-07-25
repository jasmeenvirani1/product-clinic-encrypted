const path = require("path");
const { User } = require("../models");
const { suggestThemeColorFromLogo, FALLBACK_PRIMARY } = require("../services/logoThemeService");
const log = require("../utils/logger");

const MODULE = "BrandSetupController";

// Public URL for a stored logo file (served via the static /uploads mount).
const logoUrl = (filename) => (filename ? `/uploads/logos/${filename}` : null);

/**
 * Authenticated (post-OTP registration step).
 * Accepts a single "logo" upload, persists it on the user, then runs the
 * AI vision service to suggest a primary theme colour. The suggestion is
 * NOT applied here — the frontend shows it and the user chooses to apply
 * (via the existing PUT /super-admin/theme) or keep the default.
 */
exports.uploadLogoAndSuggestTheme = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "A logo image is required." });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Persist the logo filename on the user regardless of the AI outcome.
    user.logo = file.filename;
    await user.save();

    // Run AI suggestion — always resolves (falls back to a safe default palette).
    const absolutePath = file.path || path.join(process.cwd(), "uploads", "logos", file.filename);
    const { suggestedColors, suggestedPrimary, source } = await suggestThemeColorFromLogo(absolutePath);

    log.info(MODULE, "uploadLogoAndSuggestTheme", {
      userId: user.id,
      logo: file.filename,
      suggestedPrimary,
      source,
    });

    return res.status(200).json({
      success: true,
      data: {
        logo: user.logo,
        logo_url: logoUrl(user.logo),
        // Full suggested palette (17 keys, no semantic colours). The client
        // shows these for confirmation and applies the whole set on "Apply".
        suggestedColors,
        suggestedPrimary,
        // "ai" → real suggestion; "fallback" → default palette used
        source,
        fallbackPrimary: FALLBACK_PRIMARY,
      },
    });
  } catch (err) {
    log.error(MODULE, "uploadLogoAndSuggestTheme", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
