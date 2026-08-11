// One-off backfill script: sets Plan.max_whatsapp_numbers on the existing
// Starter / Professional / Enterprise plan rows to match the product's
// stated WhatsApp-number connection structure (1 number / 3 numbers /
// unlimited — see GitHub issue #46).
//
// This repo has no migrations framework (schema changes are applied via
// sequelize.sync({ alter: true }) on boot) so this script is the
// "migration" for data — same pattern as seedPlanFeatureFlags.js. Run it
// manually, once, after deploying the max_whatsapp_numbers column. Safe to
// re-run — it is idempotent, always (re)setting max_whatsapp_numbers to the
// canonical value for a matched plan name rather than merging.
//
// Usage:
//   node backend/scripts/seedPlanWhatsAppLimits.js
//
// Matching is case-insensitive substring match against plan_name, e.g. a
// plan named "Starter Plan" or "Starter" both match the Starter tier. Plans
// that don't match any of the 3 known tier names are left untouched and
// reported in the output so they can be handled manually.

require("dotenv").config();
const { sequelize, Plan } = require("../models");

const TIER_MATCHERS = [
  // null = unlimited (matches Plan.credit_limit's own null-means-unlimited
  // sentinel — see Plan.js / creditService.js).
  { tier: "Starter", pattern: /starter/i, max_whatsapp_numbers: 1 },
  { tier: "Professional", pattern: /professional|pro\b/i, max_whatsapp_numbers: 3 },
  { tier: "Enterprise", pattern: /enterprise/i, max_whatsapp_numbers: null },
  { tier: "Custom", pattern: /custom/i, max_whatsapp_numbers: null },
];

function matchTier(planName) {
  const name = String(planName || "");
  for (const entry of TIER_MATCHERS) {
    if (entry.pattern.test(name)) return entry;
  }
  return null;
}

(async () => {
  const results = { updated: [], skipped: [] };
  try {
    await sequelize.authenticate();

    const plans = await Plan.findAll({ where: { is_deleted: false } });

    for (const plan of plans) {
      const match = matchTier(plan.plan_name);
      if (!match) {
        results.skipped.push({ id: plan.id, plan_name: plan.plan_name, reason: "no matching tier name" });
        continue;
      }

      plan.max_whatsapp_numbers = match.max_whatsapp_numbers;
      await plan.save();

      results.updated.push({
        id: plan.id,
        plan_name: plan.plan_name,
        tier: match.tier,
        max_whatsapp_numbers: plan.max_whatsapp_numbers,
      });
    }

    console.log(JSON.stringify({ success: true, ...results }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ success: false, message: err.message, ...results }, null, 2));
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
