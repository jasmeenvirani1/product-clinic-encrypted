const { Lesson, LessonReel, InstagramReel } = require("../models");
const log = require("../utils/logger");

const MODULE = "LessonController";

// Same convention as instagramMetaRoutes.js / specialityController.resolveTenantId —
// "which tenant does this staff/owner user act on behalf of."
function resolveTenantId(req) {
  return req.user?.tenant_id || req.user?.id || null;
}

// Shared reel-attribute allowlist — mirrors clinicController.getPublicByUsername's
// existing `videos` mapping discipline exactly. NEVER include media_url/media_type/
// media_product_type here.
const REEL_ATTRIBUTES = ["id", "ig_media_id", "thumbnail_url", "permalink", "like_count", "comments_count", "caption"];

// Maps a Lesson (+ eager-loaded `reels` association) into the public/authenticated
// response shape. Exported so clinicController.getPublicByUsername can reuse it
// verbatim for the public `lessons` array — guarantees the allowlist discipline
// can't drift between the authenticated and public code paths.
function toLessonPayload(lesson) {
  const plain = typeof lesson.get === "function" ? lesson.get({ plain: true }) : lesson;
  const reels = Array.isArray(plain.reels) ? plain.reels : [];
  return {
    id: plain.id,
    title: plain.title,
    description: plain.description ?? "",
    reels: reels.map((r) => ({
      id: r.ig_media_id,
      thumbnail_url: r.thumbnail_url,
      permalink: r.permalink,
      // Instagram Insights out of scope (same as videos mapping) — hardcoded 0.
      views: 0,
      likes: r.like_count,
      caption: r.caption ?? "",
    })),
  };
}

// Loads a Lesson by its global PK with NO tenant filter in the query, then
// explicitly compares tenant_id. Deliberate divergence from Speciality's
// scoped-where/404-only pattern: a single global auto-increment id means
// tenant A could pass tenant B's real lesson id, so the acceptance criteria
// require a 403 (not a silent 404) on a genuine ownership mismatch, and a
// plain 404 only when the row truly doesn't exist. Do NOT collapse this back
// to a single tenant-scoped `where` — that would silently violate the
// acceptance criteria this ticket is built against.
async function loadOwnedLesson(lessonId, tenantId, options = {}) {
  const lesson = await Lesson.findByPk(lessonId, options);
  if (!lesson) {
    return { error: { status: 404, message: "Lesson not found." } };
  }
  if (lesson.tenant_id !== tenantId) {
    return { error: { status: 403, message: "You do not have access to this lesson." } };
  }
  return { lesson };
}

const REELS_INCLUDE = [
  {
    model: InstagramReel,
    as: "reels",
    attributes: REEL_ATTRIBUTES,
    through: { attributes: [] },
  },
];

// GET /api/lessons — the authenticated "my lessons" list for the manage UI.
exports.list = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const lessons = await Lesson.findAll({
      where: { tenant_id: tenantId },
      attributes: ["id", "title", "description"],
      include: REELS_INCLUDE,
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({ success: true, lessons: lessons.map(toLessonPayload) });
  } catch (err) {
    log.error(MODULE, "list", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/lessons/reels/available — the tenant's own synced reels, keyed by
// the internal InstagramReel.id PK (needed by the reel-picker UI to attach
// by, since neither the public videos array nor lesson payloads expose that
// PK by design). Authenticated + tenant-scoped only, no cross-tenant risk.
exports.availableReels = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const reels = await InstagramReel.findAll({
      where: { tenant_id: tenantId },
      attributes: ["id", "ig_media_id", "thumbnail_url", "permalink", "caption", "like_count"],
      order: [["posted_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      reels: reels.map((r) => ({
        id: r.id,
        ig_media_id: r.ig_media_id,
        thumbnail_url: r.thumbnail_url,
        permalink: r.permalink,
        caption: r.caption ?? "",
        like_count: r.like_count,
      })),
    });
  } catch (err) {
    log.error(MODULE, "availableReels", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// POST /api/lessons — create a new lesson (title required, description optional).
exports.create = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const { title, description } = req.body || {};
    const trimmedTitle = typeof title === "string" ? title.trim() : "";
    if (!trimmedTitle) {
      return res.status(400).json({ success: false, message: "title is required." });
    }

    const lesson = await Lesson.create({
      tenant_id: tenantId,
      title: trimmedTitle,
      description: description !== undefined ? description : null,
    });

    // Reload with the (empty) reels association so toLessonPayload's shape is consistent.
    const created = await Lesson.findByPk(lesson.id, { include: REELS_INCLUDE });

    log.info(MODULE, "create", { userId: req.user.id, tenantId, lessonId: lesson.id });
    return res.status(200).json({ success: true, message: "Lesson created.", lesson: toLessonPayload(created) });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// PUT /api/lessons/:id — update title/description of a lesson the caller owns.
exports.update = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const { lesson, error } = await loadOwnedLesson(req.params.id, tenantId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const { title, description } = req.body || {};
    if (title !== undefined) {
      const trimmedTitle = typeof title === "string" ? title.trim() : "";
      if (!trimmedTitle) {
        return res.status(400).json({ success: false, message: "title cannot be empty." });
      }
      lesson.title = trimmedTitle;
    }
    if (description !== undefined) lesson.description = description;

    await lesson.save();

    const updated = await Lesson.findByPk(lesson.id, { include: REELS_INCLUDE });

    log.info(MODULE, "update", { userId: req.user.id, tenantId, lessonId: lesson.id });
    return res.status(200).json({ success: true, message: "Lesson updated.", lesson: toLessonPayload(updated) });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// DELETE /api/lessons/:id — delete a lesson the caller owns (join rows cascade
// via LessonReel's FK; Sequelize will handle removal through destroy()).
exports.remove = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const { lesson, error } = await loadOwnedLesson(req.params.id, tenantId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await LessonReel.destroy({ where: { lesson_id: lesson.id } });
    await lesson.destroy();

    log.info(MODULE, "remove", { userId: req.user.id, tenantId, lessonId: req.params.id });
    return res.status(200).json({ success: true, message: "Lesson deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// POST /api/lessons/:id/reels — attach a reel (by internal InstagramReel.id)
// to a lesson the caller owns. The reel itself must also belong to the SAME
// tenant as the lesson — independent 404/403 check, so a tenant can never
// attach another tenant's InstagramReel.id to their own lesson.
exports.attachReel = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const { lesson, error } = await loadOwnedLesson(req.params.id, tenantId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const { instagram_reel_id } = req.body || {};
    if (!instagram_reel_id) {
      return res.status(400).json({ success: false, message: "instagram_reel_id is required." });
    }

    const reel = await InstagramReel.findByPk(instagram_reel_id);
    if (!reel) {
      return res.status(404).json({ success: false, message: "Reel not found." });
    }
    if (reel.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: "You do not have access to this reel." });
    }

    // findOrCreate so a double-attach is a no-op, not a unique-constraint 500.
    await LessonReel.findOrCreate({
      where: { lesson_id: lesson.id, instagram_reel_id: reel.id },
      defaults: { lesson_id: lesson.id, instagram_reel_id: reel.id },
    });

    const updated = await Lesson.findByPk(lesson.id, { include: REELS_INCLUDE });

    log.info(MODULE, "attachReel", { userId: req.user.id, tenantId, lessonId: lesson.id, reelId: reel.id });
    return res.status(200).json({ success: true, message: "Reel attached.", lesson: toLessonPayload(updated) });
  } catch (err) {
    log.error(MODULE, "attachReel", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// DELETE /api/lessons/:id/reels/:reelId — detach a reel from a lesson the caller owns.
exports.detachReel = async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: "No tenant" });

    const { lesson, error } = await loadOwnedLesson(req.params.id, tenantId);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await LessonReel.destroy({ where: { lesson_id: lesson.id, instagram_reel_id: req.params.reelId } });

    const updated = await Lesson.findByPk(lesson.id, { include: REELS_INCLUDE });

    log.info(MODULE, "detachReel", { userId: req.user.id, tenantId, lessonId: lesson.id, reelId: req.params.reelId });
    return res.status(200).json({ success: true, message: "Reel detached.", lesson: toLessonPayload(updated) });
  } catch (err) {
    log.error(MODULE, "detachReel", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

module.exports.resolveTenantId = resolveTenantId;
module.exports.toLessonPayload = toLessonPayload;
module.exports.loadOwnedLesson = loadOwnedLesson;
module.exports.REEL_ATTRIBUTES = REEL_ATTRIBUTES;
