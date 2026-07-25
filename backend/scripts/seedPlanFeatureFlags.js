// One-off backfill script: sets Plan.feature_flags on the existing
// Starter / Professional / Enterprise / Custom plan rows to match the
// product's plan-wise feature table (see backend/constants/planFeatures.js
// for the canonical defaults, and GitHub issue #2 for the product
// requirement this implements).
//
// This repo has no migrations framework (schema changes are applied via
// sequelize.sync({ alter: true }) on boot) so this script is the
// "migration" for data: run it manually, once, after deploying the
// feature_flags column. Safe to re-run — it is idempotent, always
// (re)setting feature_flags to the canonical preset for a matched plan
// name rather than merging.
//
// Usage:
//   node backend/scripts/seedPlanFeatureFlags.js
//
// Matching is case-insensitive substring match against plan_name, e.g. a
// plan named "Starter Plan" or "Starter" both match the Starter preset.
// Plans that don't match any of the 4 known tier names are left untouched
// and reported in the output so they can be handled manually (e.g. a
// custom-named Enterprise-equivalent plan).

require("dotenv").config();
const { sequelize, Plan } = require("../models");
const { PLAN_FEATURE_PRESETS } = require("../constants/planFeatures");

const TIER_MATCHERS = [
  { tier: "Starter", pattern: /starter/i },
  { tier: "Professional", pattern: /professional|pro\b/i },
  { tier: "Enterprise", pattern: /enterprise/i },
  { tier: "Custom", pattern: /custom/i },
];

function matchTier(planName) {
  const name = String(planName || "");
  for (const { tier, pattern } of TIER_MATCHERS) {
    if (pattern.test(name)) return tier;
  }
  return null;
}

(async () => {
  const results = { updated: [], skipped: [] };
  try {
    await sequelize.authenticate();

    const plans = await Plan.findAll({ where: { is_deleted: false } });

    for (const plan of plans) {
      const tier = matchTier(plan.plan_name);
      if (!tier) {
        results.skipped.push({ id: plan.id, plan_name: plan.plan_name, reason: "no matching tier name" });
        continue;
      }

      const preset = PLAN_FEATURE_PRESETS[tier];
      plan.feature_flags = { ...preset };
      await plan.save();

      results.updated.push({ id: plan.id, plan_name: plan.plan_name, tier, feature_flags: plan.feature_flags });
    }

    console.log(JSON.stringify({ success: true, ...results }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ success: false, message: err.message, ...results }, null, 2));
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
