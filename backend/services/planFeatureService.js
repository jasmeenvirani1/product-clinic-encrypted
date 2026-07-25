// Live-computed plan feature resolution.
//
// Deliberately NOT a snapshot-at-purchase model: unlike the old
// campaign_count allowance (which had to be frozen at purchase time to
// avoid retroactively changing a paying customer's grant when an admin
// edited a Plan), feature flags are meant to take effect immediately when
// a plan's feature_flags or a user's feature_overrides are edited. This
// service recomputes on every call rather than reading a stored snapshot.
//
// This file only builds the gating plumbing — it does not implement any of
// the 7 underlying features themselves.

const { FEATURE_KEYS, FEATURE_DEFAULTS } = require("../constants/planFeatures");

/**
 * Resolve the effective feature set for a user by layering, in priority
 * order (lowest to highest):
 *   1. FEATURE_DEFAULTS (safe "everything off" baseline)
 *   2. the user's Plan.feature_flags (if a Plan is loaded/assigned)
 *   3. the user's own feature_overrides (Custom-plan per-account overrides)
 *
 * This is a shallow per-key merge, not a whole-object replace, so an
 * override only needs to specify the keys that actually differ from the
 * base plan, and a plan's feature_flags only needs to specify the keys
 * that differ from the defaults.
 *
 * @param {object} user - a Sequelize User instance (or plain object) that
 *   may have a loaded `Plan` association and/or `feature_overrides`.
 * @returns {Record<string, boolean|string>} resolved feature flags, keyed
 *   by FEATURE_KEYS.
 */
function getEffectiveFeatures(user) {
  const planFlags = user?.Plan?.feature_flags || {};
  const overrides = user?.feature_overrides || {};

  const effective = { ...FEATURE_DEFAULTS };

  for (const key of FEATURE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(planFlags, key)) {
      effective[key] = planFlags[key];
    }
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      effective[key] = overrides[key];
    }
  }

  return effective;
}

/**
 * Check a single feature for a user. Returns the resolved value for that
 * key (boolean for most features, the enum string for the graded
 * dedicated_clinic_page feature).
 *
 * Usage (once a feature is actually built):
 *   if (!hasFeature(req.user, "video_like")) return res.status(403)...
 *
 * @param {object} user
 * @param {string} key - one of FEATURE_KEYS
 * @returns {boolean|string}
 */
function hasFeature(user, key) {
  const effective = getEffectiveFeatures(user);
  return effective[key];
}

module.exports = {
  getEffectiveFeatures,
  hasFeature,
};
