const { User, Plan, WhatsAppSession } = require("../models");

// Centralized WhatsApp-number connection quota logic, mirroring
// creditService's numeric-quota shape (Plan.credit_limit / credits_used) but
// for WhatsAppSession slot rows instead of AI-reply credits.
// Plan.max_whatsapp_numbers === null means unlimited (e.g. Enterprise). A
// tenant's used count is the number of WhatsAppSession rows already claimed
// (regardless of connection status — a row is a reserved slot).

// Single source of truth for a tenant's WhatsApp-number cap.
// Returns: null = unlimited, a positive number = cap.
// Resolution order (lowest → highest priority), same layering as
// planFeatureService.getEffectiveFeatures:
//   1. Plan.max_whatsapp_numbers (null-safe default of 1 if no plan at all —
//      matches WhatsAppSession's own default slot=1 and errs conservative)
//   2. User.feature_overrides.max_whatsapp_numbers (per-account override,
//      same override layer used for feature_flags keys; NOT one of the typed
//      FEATURE_KEYS since it isn't boolean/enum, but the same
//      feature_overrides JSONB column is reused as the storage location —
//      just read directly, no need to route through getEffectiveFeatures/
//      validateFeatureFlags which are typed for the 8 existing keys only)
function resolveNumberLimit(user) {
  if (!user) return 1;
  // IMPORTANT: `??` cannot be used here — `user.Plan.max_whatsapp_numbers`
  // being genuinely `null` (unlimited) is a valid, meaningful value, not a
  // missing one. `??` would incorrectly coerce that `null` back to the
  // conservative default of 1, silently breaking unlimited plans. Only fall
  // back to 1 when there's no Plan relation loaded/assigned at all.
  const planLimit = user.Plan ? user.Plan.max_whatsapp_numbers : 1;
  const overrides = user.feature_overrides || {};
  if (Object.prototype.hasOwnProperty.call(overrides, "max_whatsapp_numbers")) {
    return overrides.max_whatsapp_numbers; // null or number, trusted as already-validated
  }
  return planLimit;
}

// Counts existing slots for a tenant. Counts ALL rows regardless of status
// (unlinked/connecting/qr_pending/connected/disconnected/logged_out) because
// a row = a reserved slot the tenant has already claimed, mirroring how
// buildSessionsPayload/the remove-route's "totalSlots" already counts rows,
// not just "connected" ones (backend/services/whatsappQrBootstrap.js).
async function countUsedSlots(tenantId) {
  return WhatsAppSession.count({ where: { tenant_id: tenantId } });
}

// Returns { limit, used, atCapacity } for a tenant. `limit: null` = unlimited.
async function getNumberLimitStatus(tenantId) {
  const tenantUser = await User.findByPk(tenantId, {
    include: [{ model: Plan, attributes: ["max_whatsapp_numbers"] }],
    attributes: ["id", "feature_overrides"],
  });
  const limit = resolveNumberLimit(tenantUser);
  const used = await countUsedSlots(tenantId);
  const atCapacity = limit !== null && used >= limit;
  return { limit, used, atCapacity };
}

// Boolean check used by the connect flow BEFORE a NEW slot is created.
// existingRow=true means the slot already has a WhatsAppSession row (this is
// a reconnect/re-auth of an already-counted slot, not a NEW one) — always
// allowed regardless of capacity, since it doesn't increase `used`. This is
// the grandfather clause: tenants already over a newly-lowered plan limit
// can still reconnect/re-scan existing slots, only NET-NEW slot creation is
// blocked.
async function canAddNewSlot(tenantId, { existingRow } = {}) {
  if (existingRow) return true;
  const { atCapacity } = await getNumberLimitStatus(tenantId);
  return !atCapacity;
}

module.exports = { resolveNumberLimit, countUsedSlots, getNumberLimitStatus, canAddNewSlot };
