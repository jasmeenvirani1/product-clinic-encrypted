const { User, Plan, Role } = require("../models");

// Centralized AI-credit logic so every automatic AI-reply path enforces the
// same policy: 1 successful automatic AI reply (including auto follow-ups) =
// 1 credit. Manual/staff replies are NOT counted and never call this.
// Plan.credit_limit === null means unlimited (e.g. Enterprise). credits_used is
// the running per-clinic tally, reset to 0 on each plan activation/renewal.

// Cap for clinics still on the 14-day free trial (no paid plan yet).
const TRIAL_CREDIT_LIMIT = 500;

// Single source of truth for a user's AI-reply credit limit.
// Returns: null = unlimited, a positive number = cap, 0 = no credits (AI paused).
// The user must have its Plan + Role associations loaded.
//   - super_admin            → null (never limited)
//   - active paid plan       → plan.credit_limit (null = unlimited, e.g. Enterprise)
//   - active 14-day trial    → TRIAL_CREDIT_LIMIT (500)
//   - expired plan / expired or no trial → 0  (must renew/subscribe)
function resolveCreditLimit(user, now = new Date()) {
  if (!user) return 0;
  if (user.Role?.name === "super_admin") return null;

  const planActive =
    !!user.plan_id &&
    user.plan_expires_at &&
    new Date(user.plan_expires_at) > now;
  if (planActive) return user.Plan?.credit_limit ?? null;

  const trialActive = user.trial_ends_at && new Date(user.trial_ends_at) > now;
  if (trialActive) return TRIAL_CREDIT_LIMIT;

  return 0; // no active plan and no active trial → no AI credits
}

// Returns { exhausted, creditLimit, creditsUsed } for a tenant (clinic) user id.
// This runs on EVERY inbound AI-eligible message (all channels + follow-ups),
// so it's the single integration point for usage-threshold alerts (75/90/100%).
async function getCreditStatus(tenantId) {
  const tenantUser = await User.findByPk(tenantId, {
    include: [
      { model: Plan, attributes: ["credit_limit"] },
      { model: Role, attributes: ["name"] },
    ],
  });
  const creditsUsed = tenantUser?.credits_used ?? 0;
  const creditLimit = resolveCreditLimit(tenantUser);
  const exhausted = creditLimit !== null && creditsUsed >= creditLimit;

  // Fire-and-forget usage-threshold alerts. Not awaited so it never adds latency
  // to the reply decision; the already-loaded tenantUser is reused to avoid an
  // extra query. Lazy require avoids a circular dependency
  // (creditAlertService → whatsappQrBootstrap → creditService).
  if (tenantUser) {
    try {
      const { maybeNotifyThresholds } = require("./creditAlertService");
      maybeNotifyThresholds(tenantId, tenantUser).catch(() => {});
    } catch (_) {
      /* swallow — alerting must never affect the credit check */
    }
  }

  return { exhausted, creditLimit, creditsUsed };
}

// Atomically consumes one credit. Call ONLY after an AI reply was sent
// successfully, so failed/undelivered messages never cost the clinic.
async function consumeCredit(tenantId) {
  await User.increment("credits_used", { by: 1, where: { id: tenantId } });
  // Check usage thresholds right after the new total lands, so the reply that
  // *crosses* 75/90/100% fires its alert immediately (no one-message lag).
  // getCreditStatus also runs this on every inbound, which additionally covers
  // accounts that were already exhausted before crossing here. Dedup via
  // credit_alert_level makes the double-coverage safe. Fire-and-forget; lazy
  // require avoids a circular dependency.
  try {
    const { maybeNotifyThresholds } = require("./creditAlertService");
    maybeNotifyThresholds(tenantId).catch(() => {});
  } catch (_) {
    /* swallow — alerting must never break credit consumption */
  }
}

module.exports = { getCreditStatus, consumeCredit, resolveCreditLimit, TRIAL_CREDIT_LIMIT };
