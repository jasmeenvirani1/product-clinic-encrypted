// Single source of truth for the plan-based feature-flag system.
//
// This module defines WHICH features exist and WHAT values they can take.
// It intentionally does not implement any of the 7 underlying features
// (chapters, dedicated clinic pages, WhatsApp multi-session, video like,
// automatic website generation) — it only defines the gating plumbing so
// other code can check "is this feature available for this user" once
// those features are actually built.
//
// Feature keys are stable snake_case identifiers, never display strings,
// so gating code never string-matches on plan-editable text.

// Most features are simple booleans (available / not available).
const BOOLEAN_FEATURE_KEYS = [
  "whatsapp_multi_connection",
  "chapter_instagram_integration",
  "instagram_realtime_fetch",
  "chapter_creation",
  "video_like",
  "automatic_website_generation",
];

// dedicated_clinic_page is graded — an enum, not a boolean.
const CLINIC_PAGE_LEVELS = Object.freeze({
  NONE: "none",
  VIDEO_UPLOAD_ONLY: "video_upload_only",
  FULL_ACCESS: "full_access",
});

const CLINIC_PAGE_LEVEL_VALUES = Object.values(CLINIC_PAGE_LEVELS);

// All feature keys, boolean + graded.
const FEATURE_KEYS = Object.freeze([...BOOLEAN_FEATURE_KEYS, "dedicated_clinic_page"]);

// Baseline defaults (Starter-equivalent: everything off / lowest grade).
// Used as the first layer in the getEffectiveFeatures() resolution so any
// key missing from a Plan row's feature_flags safely falls back to "off"
// rather than throwing or being treated as truthy.
const FEATURE_DEFAULTS = Object.freeze({
  whatsapp_multi_connection: false,
  dedicated_clinic_page: CLINIC_PAGE_LEVELS.NONE,
  chapter_instagram_integration: false,
  instagram_realtime_fetch: false,
  chapter_creation: false,
  video_like: false,
  automatic_website_generation: false,
});

// Per-plan defaults, exactly per the product's plan table. "Custom" has no
// fixed defaults of its own — Custom accounts are expected to carry
// per-user feature_overrides on top of a base plan (see planFeatureService).
const PLAN_FEATURE_PRESETS = Object.freeze({
  Starter: Object.freeze({
    whatsapp_multi_connection: false,
    dedicated_clinic_page: CLINIC_PAGE_LEVELS.NONE,
    chapter_instagram_integration: false,
    instagram_realtime_fetch: false,
    chapter_creation: false,
    video_like: false,
    automatic_website_generation: false,
  }),
  Professional: Object.freeze({
    whatsapp_multi_connection: false,
    dedicated_clinic_page: CLINIC_PAGE_LEVELS.VIDEO_UPLOAD_ONLY,
    chapter_instagram_integration: false,
    instagram_realtime_fetch: false,
    chapter_creation: false,
    video_like: true,
    automatic_website_generation: false,
  }),
  Enterprise: Object.freeze({
    whatsapp_multi_connection: true,
    dedicated_clinic_page: CLINIC_PAGE_LEVELS.FULL_ACCESS,
    chapter_instagram_integration: true,
    instagram_realtime_fetch: true,
    chapter_creation: true,
    video_like: true,
    automatic_website_generation: true,
  }),
  // Custom is configurable per-account. This preset is only used as a
  // starting point (e.g. defaulting a newly created Custom plan row to the
  // Enterprise shape); actual entitlements for a Custom account come from
  // that account's User.feature_overrides layered on top of its base Plan.
  Custom: Object.freeze({
    whatsapp_multi_connection: true,
    dedicated_clinic_page: CLINIC_PAGE_LEVELS.FULL_ACCESS,
    chapter_instagram_integration: true,
    instagram_realtime_fetch: true,
    chapter_creation: true,
    video_like: true,
    automatic_website_generation: true,
  }),
});

function isValidClinicPageLevel(value) {
  return CLINIC_PAGE_LEVEL_VALUES.includes(value);
}

// Validates a (possibly partial) feature-flags/override object. Returns
// { value } with only recognized keys normalized to correct types, or
// { error } describing the first problem found. Unknown keys are dropped
// silently (defensive against stale client payloads), not treated as errors,
// since overrides are intentionally partial/sparse.
function validateFeatureFlags(input) {
  if (input === undefined || input === null) {
    return { value: {} };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { error: "feature_flags must be an object." };
  }

  const value = {};

  for (const key of BOOLEAN_FEATURE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      const raw = input[key];
      if (typeof raw === "boolean") {
        value[key] = raw;
      } else if (raw === "true" || raw === "false") {
        value[key] = raw === "true";
      } else {
        return { error: `${key} must be a boolean.` };
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "dedicated_clinic_page")) {
    const raw = input.dedicated_clinic_page;
    if (!isValidClinicPageLevel(raw)) {
      return {
        error: `dedicated_clinic_page must be one of: ${CLINIC_PAGE_LEVEL_VALUES.join(", ")}.`,
      };
    }
    value.dedicated_clinic_page = raw;
  }

  return { value };
}

module.exports = {
  FEATURE_KEYS,
  BOOLEAN_FEATURE_KEYS,
  CLINIC_PAGE_LEVELS,
  CLINIC_PAGE_LEVEL_VALUES,
  FEATURE_DEFAULTS,
  PLAN_FEATURE_PRESETS,
  isValidClinicPageLevel,
  validateFeatureFlags,
};
