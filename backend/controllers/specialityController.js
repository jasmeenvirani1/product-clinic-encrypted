const { Speciality } = require("../models");
const log = require("../utils/logger");

const MODULE = "SpecialityController";

// tenant_id is always forced to null in this controller — it is the
// super-admin master-list boundary; tenant-scoped rows/resolution are
// deferred to a follow-up ticket.

// Public URL for a stored speciality detail-content image (served via the
// static /uploads mount).
const specialityImageUrl = (filename) => (filename ? `/uploads/specialities/${filename}` : null);

// POST /api/super-admin/specialities/upload-image
// POST /api/tenant/specialities/upload-image
// Accepts a single "image" upload for use inside the Detail Content rich
// text editor and returns its public URL — the editor inserts <img src="...">
// pointing here instead of embedding base64, which was blowing past the
// JSON body size limit.
exports.uploadDetailImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "An image is required." });
    }
    return res.status(200).json({
      success: true,
      data: { url: specialityImageUrl(file.filename) },
    });
  } catch (err) {
    log.error(MODULE, "uploadDetailImage", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/public/specialities — consumed by the public landing page (no auth).
// Returns only active, non-deleted, master (tenant_id: null) rows, ordered,
// with a whitelisted attribute set.
exports.getPublic = async (_req, res) => {
  try {
    const specialities = await Speciality.findAll({
      where: { tenant_id: null, is_deleted: false, is_active: true },
      attributes: [
        "id",
        "slug",
        "name",
        "icon",
        "short_description",
        "detail_content",
        "order",
        "meta_title",
        "meta_description",
        "og_title",
        "og_description",
        "og_image",
        "canonical_url",
        "keywords",
      ],
      order: [["order", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: specialities });
  } catch (err) {
    log.error(MODULE, "getPublic", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/super-admin/specialities — admin list (includes inactive).
exports.getAll = async (_req, res) => {
  try {
    const specialities = await Speciality.findAll({
      where: { tenant_id: null, is_deleted: false },
      order: [["order", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: specialities });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/super-admin/specialities/:id
exports.getById = async (req, res) => {
  try {
    const speciality = await Speciality.findOne({
      where: { id: req.params.id, tenant_id: null, is_deleted: false },
    });
    if (!speciality) {
      return res.status(404).json({ success: false, message: "Speciality not found." });
    }
    return res.status(200).json({ success: true, data: speciality });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      slug,
      name,
      icon,
      short_description,
      detail_content,
      order,
      is_active,
      meta_title,
      meta_description,
      og_title,
      og_description,
      og_image,
      canonical_url,
      keywords,
    } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ success: false, message: "slug and name are required." });
    }

    const speciality = await Speciality.create({
      tenant_id: null,
      slug: slug.trim(),
      name: name.trim(),
      icon: icon || null,
      short_description: short_description || null,
      detail_content: detail_content || {},
      order: Number.isFinite(+order) ? +order : 0,
      is_active: is_active !== false,
      meta_title: meta_title || null,
      meta_description: meta_description || null,
      og_title: og_title || null,
      og_description: og_description || null,
      og_image: og_image || null,
      canonical_url: canonical_url || null,
      keywords: keywords || null,
    });

    log.info(MODULE, "create", { userId: req.user.id, specialityId: speciality.id });
    return res.status(201).json({ success: true, message: "Speciality created.", data: speciality });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "A speciality with this slug already exists." });
    }
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const speciality = await Speciality.findOne({
      where: { id: req.params.id, tenant_id: null, is_deleted: false },
    });
    if (!speciality) {
      return res.status(404).json({ success: false, message: "Speciality not found." });
    }

    const {
      slug,
      name,
      icon,
      short_description,
      detail_content,
      order,
      is_active,
      meta_title,
      meta_description,
      og_title,
      og_description,
      og_image,
      canonical_url,
      keywords,
    } = req.body;

    if (slug !== undefined) speciality.slug = slug.trim();
    if (name !== undefined) speciality.name = name.trim();
    if (icon !== undefined) speciality.icon = icon;
    if (short_description !== undefined) speciality.short_description = short_description;
    if (detail_content !== undefined) speciality.detail_content = detail_content;
    if (order !== undefined && Number.isFinite(+order)) speciality.order = +order;
    if (is_active !== undefined) speciality.is_active = is_active;
    if (meta_title !== undefined) speciality.meta_title = meta_title;
    if (meta_description !== undefined) speciality.meta_description = meta_description;
    if (og_title !== undefined) speciality.og_title = og_title;
    if (og_description !== undefined) speciality.og_description = og_description;
    if (og_image !== undefined) speciality.og_image = og_image;
    if (canonical_url !== undefined) speciality.canonical_url = canonical_url;
    if (keywords !== undefined) speciality.keywords = keywords;

    await speciality.save();

    log.info(MODULE, "update", { userId: req.user.id, specialityId: speciality.id });
    return res.status(200).json({ success: true, message: "Speciality updated.", data: speciality });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "A speciality with this slug already exists." });
    }
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const speciality = await Speciality.findOne({
      where: { id: req.params.id, tenant_id: null, is_deleted: false },
    });
    if (!speciality) {
      return res.status(404).json({ success: false, message: "Speciality not found." });
    }

    speciality.is_deleted = true;
    await speciality.save();

    log.info(MODULE, "remove", { userId: req.user.id, specialityId: speciality.id });
    return res.status(200).json({ success: true, message: "Speciality deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ---------------------------------------------------------------------------
// Tenant-side override support (ticket #5) — additive only, below this line.
// Existing super-admin exports above are untouched.
// ---------------------------------------------------------------------------

// Mirrors themeController.js's resolveTenantId exactly (same role/ownership rule).
function resolveTenantId(req) {
  const u = req.user || {};
  if (u.Role && u.Role.name === "super_admin") return null;
  return u.tenant_id || u.id || null;
}

// List-level overlay by slug — NOT single-row merge (Speciality is many-rows-per-tenant).
// Returns master rows (tenant_id: null) with any tenant_id=tenantId row for the same
// slug replacing the master row WHOLESALE (full-row override, not deep field merge).
// Tenant-only slugs (no master row of that slug) are included as-is (net "addition").
// Each returned plain object is annotated with `has_master: boolean` (true if a
// tenant_id:null row with that slug exists, independent of which row won) so the
// frontend can distinguish "your override" from "your addition" without a second fetch.
async function resolveSpecialities(tenantId, { includeInactive = false } = {}) {
  const masterWhere = { tenant_id: null, is_deleted: false };
  if (!includeInactive) masterWhere.is_active = true;

  // When tenantId is null (super-admin calling a "resolved" view, if ever needed),
  // resolution IS just the master list itself.
  if (tenantId == null) {
    const masterRows = await Speciality.findAll({
      where: masterWhere,
      order: [["order", "ASC"], ["id", "ASC"]],
    });
    return masterRows.map((r) => ({ ...r.get({ plain: true }), has_master: true }));
  }

  const tenantWhere = { tenant_id: tenantId, is_deleted: false };
  if (!includeInactive) tenantWhere.is_active = true;

  const masterRows = await Speciality.findAll({ where: masterWhere });
  const tenantRows = await Speciality.findAll({ where: tenantWhere });

  const bySlug = new Map(masterRows.map((r) => [r.slug, { ...r.get({ plain: true }), has_master: true }]));
  for (const row of tenantRows) {
    const plain = row.get({ plain: true });
    plain.has_master = bySlug.has(row.slug);
    bySlug.set(row.slug, plain); // full-row override / addition
  }

  return Array.from(bySlug.values()).sort(
    (a, b) => a.order - b.order || a.id - b.id
  );
}

// Single-item resolution for a future detail page ticket — same override rule.
async function resolveSpecialityBySlug(tenantId, slug) {
  if (tenantId != null) {
    const own = await Speciality.findOne({ where: { tenant_id: tenantId, slug, is_deleted: false } });
    if (own) return own;
  }
  return Speciality.findOne({ where: { tenant_id: null, slug, is_deleted: false } });
}

const FIELD_KEYS = [
  "slug",
  "name",
  "icon",
  "short_description",
  "detail_content",
  "order",
  "is_active",
  "meta_title",
  "meta_description",
  "og_title",
  "og_description",
  "og_image",
  "canonical_url",
  "keywords",
];

// GET /api/tenant/specialities — resolved (merged) list for the caller's tenant.
// Read-only, no feature gate (drives the locked/unlocked UI itself, so it cannot
// itself be gated). Includes the tenant's own inactive overrides.
exports.getTenantList = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const specialities = await resolveSpecialities(tenantId, { includeInactive: true });
    return res.status(200).json({ success: true, data: specialities });
  } catch (err) {
    log.error(MODULE, "getTenantList", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// POST /api/tenant/specialities — create a tenant override/addition.
// findOrCreate by (tenant_id, slug); if the row already existed, treat this as
// "re-customize" (upsert semantics) rather than erroring.
exports.createOverride = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const { slug, name } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ success: false, message: "slug and name are required." });
    }

    const trimmedSlug = slug.trim();
    const defaults = { tenant_id: tenantId, slug: trimmedSlug };
    for (const key of FIELD_KEYS) {
      if (key === "slug") continue;
      if (req.body[key] !== undefined) defaults[key] = req.body[key];
    }
    if (defaults.name !== undefined) defaults.name = defaults.name.trim();
    if (defaults.is_active === undefined) defaults.is_active = true;
    if (defaults.order === undefined || !Number.isFinite(+defaults.order)) defaults.order = 0;
    if (defaults.detail_content === undefined) defaults.detail_content = {};

    const [speciality, created] = await Speciality.findOrCreate({
      where: { tenant_id: tenantId, slug: trimmedSlug },
      defaults,
    });

    if (!created) {
      // Row already existed — treat as an update (re-customize).
      for (const key of FIELD_KEYS) {
        if (key === "slug") continue;
        if (req.body[key] !== undefined) {
          speciality[key] = key === "name" ? req.body[key].trim() : req.body[key];
        }
      }
      await speciality.save();
      log.info(MODULE, "createOverride:updated", { userId: req.user.id, specialityId: speciality.id, tenantId });
      return res.status(200).json({ success: true, message: "Speciality override updated.", data: speciality });
    }

    log.info(MODULE, "createOverride:created", { userId: req.user.id, specialityId: speciality.id, tenantId });
    return res.status(201).json({ success: true, message: "Speciality override created.", data: speciality });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "A speciality with this slug already exists." });
    }
    log.error(MODULE, "createOverride", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// PUT /api/tenant/specialities/:slug — update the caller's own override row.
// 404 if no tenant-owned row exists for that slug (must "Customize" first via
// createOverride, matching the UI's two-action design).
exports.updateOverride = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const speciality = await Speciality.findOne({
      where: { tenant_id: tenantId, slug: req.params.slug, is_deleted: false },
    });
    if (!speciality) {
      return res.status(404).json({ success: false, message: "Speciality not found." });
    }

    const {
      slug,
      name,
      icon,
      short_description,
      detail_content,
      order,
      is_active,
      meta_title,
      meta_description,
      og_title,
      og_description,
      og_image,
      canonical_url,
      keywords,
    } = req.body;

    if (slug !== undefined) speciality.slug = slug.trim();
    if (name !== undefined) speciality.name = name.trim();
    if (icon !== undefined) speciality.icon = icon;
    if (short_description !== undefined) speciality.short_description = short_description;
    if (detail_content !== undefined) speciality.detail_content = detail_content;
    if (order !== undefined && Number.isFinite(+order)) speciality.order = +order;
    if (is_active !== undefined) speciality.is_active = is_active;
    if (meta_title !== undefined) speciality.meta_title = meta_title;
    if (meta_description !== undefined) speciality.meta_description = meta_description;
    if (og_title !== undefined) speciality.og_title = og_title;
    if (og_description !== undefined) speciality.og_description = og_description;
    if (og_image !== undefined) speciality.og_image = og_image;
    if (canonical_url !== undefined) speciality.canonical_url = canonical_url;
    if (keywords !== undefined) speciality.keywords = keywords;

    await speciality.save();

    log.info(MODULE, "updateOverride", { userId: req.user.id, specialityId: speciality.id, tenantId });
    return res.status(200).json({ success: true, message: "Speciality updated.", data: speciality });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ success: false, message: "A speciality with this slug already exists." });
    }
    log.error(MODULE, "updateOverride", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// DELETE /api/tenant/specialities/:slug — revert the caller's override back to the
// inherited master version. Mirrors themeController.js's resetTheme clear/revert
// pattern adapted to row-level: hard-delete the tenant's own row (is_deleted is
// reserved for the super-admin's own delete semantics on master rows; a tenant row
// existing at all IS the "customized" signal, so once removed the slug cleanly falls
// back to master with no orphaned row). If the slug has no master row either
// (tenant-only addition), destroying it removes the speciality entirely — correct,
// since there is nothing to revert to.
exports.revertOverride = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    const slug = req.params.slug;

    const own = await Speciality.findOne({ where: { tenant_id: tenantId, slug } });
    if (!own) {
      return res.status(404).json({ success: false, message: "Speciality not found." });
    }

    await own.destroy();

    const resolved = await resolveSpecialityBySlug(tenantId, slug);

    log.info(MODULE, "revertOverride", { userId: req.user.id, tenantId, slug });
    return res.status(200).json({
      success: true,
      message: resolved ? "Speciality reverted to default." : "Speciality removed.",
      data: { reverted: true, resolved: resolved || null },
    });
  } catch (err) {
    log.error(MODULE, "revertOverride", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/public/specialities/:slug — global-only, for symmetry with getPublic.
// KNOWN GAP: no subdomain/header-based tenant-detection precedent exists in this
// codebase yet (confirmed: publicRoutes.js has no tenant-resolution logic anywhere).
// This endpoint intentionally serves the GLOBAL master row only. Tenant-aware public
// resolution (e.g. per-clinic public speciality pages) is deferred to the ticket that
// introduces tenant public-site routing generally — do not add partial/guessed tenant
// detection here.
exports.getPublicBySlug = async (req, res) => {
  try {
    const speciality = await Speciality.findOne({
      where: { tenant_id: null, slug: req.params.slug, is_deleted: false, is_active: true },
      attributes: [
        "id",
        "slug",
        "name",
        "icon",
        "short_description",
        "detail_content",
        "order",
        "meta_title",
        "meta_description",
        "og_title",
        "og_description",
        "og_image",
        "canonical_url",
        "keywords",
      ],
    });
    return res.status(200).json({ success: true, data: speciality || null });
  } catch (err) {
    log.error(MODULE, "getPublicBySlug", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

module.exports.resolveTenantId = resolveTenantId;
module.exports.resolveSpecialities = resolveSpecialities;
module.exports.resolveSpecialityBySlug = resolveSpecialityBySlug;
