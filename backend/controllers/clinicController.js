const { Op } = require("sequelize");
const { User, Speciality } = require("../models");
const log = require("../utils/logger");

const MODULE = "ClinicController";

// Public, unauthenticated clinic-directory endpoints (issue #29). Both exports
// below use an explicit Sequelize `attributes` allowlist — NEVER bare
// `User.findAll()`/`findOne()` — to guarantee private/internal User fields
// (email, tenant_id, plan_*, stripe_*, password_hash, role_id, credits_used,
// id_proof/address_proof, is_active/is_deleted/is_public, etc.) can never leak
// through this surface, regardless of who is viewing.
const PUBLIC_ATTRIBUTES = [
  "id",
  "username",
  "full_name",
  "clinic_name",
  "experience",
  "education",
  "category_id",
  "profile_photo",
  "logo",
  "created_at",
];

// Resolves a raw User row (plain object, PUBLIC_ATTRIBUTES-shaped) into the
// PublicClinicSummary contract from the architecture doc. `category` is
// resolved the same way authController.me does it (Speciality lookup,
// tenant_id: null master list), never the raw category_id.
async function toPublicSummary(user) {
  let category = "";
  if (user.category_id) {
    const speciality = await Speciality.findOne({
      where: { id: user.category_id, tenant_id: null, is_deleted: false },
      attributes: ["id", "name", "slug"],
    });
    if (speciality) category = speciality.name;
  }

  return {
    slug: user.username,
    name: user.full_name,
    clinic_name: user.clinic_name ?? null,
    category,
    profile_photo_url: user.profile_photo ? `/uploads/proofs/${user.profile_photo}` : null,
    logo_url: user.logo ? `/uploads/logos/${user.logo}` : null,
    username: user.username,
    experience: user.experience ?? null,
    education: user.education ?? null,
    joinedDate: user.created_at ? new Date(user.created_at).toISOString() : null,
  };
}

// GET /api/public/clinics — directory list. Only public, active clinics with
// a non-null username (username IS NULL rows have no valid public URL and are
// excluded, not treated as a bug — see architecture doc decision 1).
exports.getPublic = async (_req, res) => {
  try {
    const users = await User.findAll({
      where: {
        is_public: true,
        is_deleted: false,
        is_active: true,
        username: { [Op.ne]: null },
      },
      attributes: PUBLIC_ATTRIBUTES,
      order: [["id", "ASC"]],
    });

    const data = await Promise.all(users.map((u) => toPublicSummary(u.get({ plain: true }))));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getPublic", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/public/clinics/:username — single clinic detail. Returns
// `data: null` (HTTP 200) for unknown OR non-public usernames — never a 404 —
// mirroring specialityController.getPublicBySlug's precedent exactly, so an
// anonymous caller cannot distinguish "doesn't exist" from "exists but
// private" (avoids username enumeration).
exports.getPublicByUsername = async (req, res) => {
  try {
    const user = await User.findOne({
      where: {
        username: req.params.username,
        is_public: true,
        is_deleted: false,
        is_active: true,
      },
      attributes: PUBLIC_ATTRIBUTES,
    });

    if (!user) {
      return res.status(200).json({ success: true, data: null });
    }

    const summary = await toPublicSummary(user.get({ plain: true }));

    // Detail-only fields with no backing User column yet — included as
    // empty-but-present values (not omitted) so the frontend PublicProfile
    // TS interface, which declares these as required, needs zero shape
    // changes. Intentionally not solved by adding new columns in this ticket.
    const data = {
      ...summary,
      videos: [],
      bio: "",
      location: "",
      handle: `@${user.username}`,
      website: "",
      verified: false,
    };

    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getPublicByUsername", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
