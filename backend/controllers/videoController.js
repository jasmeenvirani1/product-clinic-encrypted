const { Video, User, Menu } = require("../models");
const log = require("../utils/logger");
const fs = require("fs");
const path = require("path");

const MODULE = "VideoController";
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "videos");

function removeFile(filename) {
  if (!filename) return;
  const full = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

// FormData sends booleans as strings ("true"/"false"/"1"/"0").
function parseBool(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

// Only one landing video allowed — clear the flag on every other video.
async function clearOtherLandingFlags(exceptId) {
  await Video.update(
    { show_on_landing: false },
    { where: { id: { [require("sequelize").Op.ne]: exceptId }, show_on_landing: true } }
  );
}

exports.getAll = async (req, res) => {
  try {
    const where = { is_deleted: false };

    if (req.query.status) {
      where.status = String(req.query.status).toLowerCase().trim();
    }

    const videos = await Video.findAll({
      where,
      include: [
        {
          model: User,
          as: "UploadedByUser",
          attributes: ["id", "full_name", "email"],
        },
        {
          model: Menu,
          as: "Menu",
          attributes: ["id", "name", "slug"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    log.info(MODULE, "getAll", { userId: req.user.id, count: videos.length });

    return res.status(200).json({ success: true, data: videos });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getById = async (req, res) => {
  try {
    const video = await Video.findOne({
      where: { id: req.params.id, is_deleted: false },
      include: [
        {
          model: User,
          as: "UploadedByUser",
          attributes: ["id", "full_name", "email"],
        },
        {
          model: Menu,
          as: "Menu",
          attributes: ["id", "name", "slug"],
        },
      ],
    });

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found." });
    }

    log.info(MODULE, "getById", { userId: req.user.id, videoId: video.id });

    return res.status(200).json({ success: true, data: video });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, description, menu_id, show_on_landing } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    const videoFile = req.files?.video?.[0];
    if (!videoFile) {
      return res.status(400).json({ success: false, message: "Video file is required." });
    }

    const thumbnailFile = req.files?.thumbnail?.[0];

    const parsedMenuId = menu_id ? Number(menu_id) : null;
    const landing = parseBool(show_on_landing);

    const video = await Video.create({
      title,
      description: description || null,
      file_path: videoFile.filename,
      thumbnail: thumbnailFile ? thumbnailFile.filename : null,
      uploaded_by: req.user.id,
      menu_id: Number.isFinite(parsedMenuId) ? parsedMenuId : null,
      show_on_landing: landing,
    });

    if (landing) await clearOtherLandingFlags(video.id);

    log.info(MODULE, "create", { userId: req.user.id, videoId: video.id });

    return res.status(201).json({ success: true, data: video, message: "Video uploaded successfully." });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const video = await Video.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found." });
    }

    const { title, description, status, menu_id, show_on_landing } = req.body;

    if (title !== undefined) video.title = title;
    if (description !== undefined) video.description = description;
    if (status !== undefined) video.status = status;
    if (menu_id !== undefined) {
      const parsed = menu_id === "" || menu_id === null ? null : Number(menu_id);
      video.menu_id = Number.isFinite(parsed) ? parsed : null;
    }
    let landingTurnedOn = false;
    if (show_on_landing !== undefined) {
      const landing = parseBool(show_on_landing);
      landingTurnedOn = landing && !video.show_on_landing;
      video.show_on_landing = landing;
    }

    const videoFile = req.files?.video?.[0];
    if (videoFile) {
      removeFile(video.file_path);
      video.file_path = videoFile.filename;
    }

    const thumbnailFile = req.files?.thumbnail?.[0];
    if (thumbnailFile) {
      removeFile(video.thumbnail);
      video.thumbnail = thumbnailFile.filename;
    }

    await video.save();

    if (landingTurnedOn) await clearOtherLandingFlags(video.id);

    log.info(MODULE, "update", { userId: req.user.id, videoId: video.id });

    return res.status(200).json({ success: true, data: video, message: "Video updated successfully." });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/** Public-facing list: only active videos, no filters */
exports.guide = async (req, res) => {
  try {
    const videos = await Video.findAll({
      where: { is_deleted: false, is_active: true, status: "active" },
      attributes: ["id", "title", "description", "file_path", "thumbnail", "menu_id", "created_at"],
      include: [
        {
          model: Menu,
          as: "Menu",
          attributes: ["id", "name", "slug"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    log.info(MODULE, "guide", { userId: req.user.id, count: videos.length });

    return res.status(200).json({ success: true, data: videos });
  } catch (err) {
    log.error(MODULE, "guide", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/** Lookup an active video by its associated menu slug. */
exports.byMenuSlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ success: false, message: "Menu slug is required." });
    }

    const menu = await Menu.findOne({ where: { slug } });
    if (!menu) {
      return res.status(200).json({ success: true, data: null });
    }

    const video = await Video.findOne({
      where: {
        menu_id: menu.id,
        is_deleted: false,
        is_active: true,
        status: "active",
      },
      attributes: ["id", "title", "description", "file_path", "thumbnail", "menu_id", "created_at"],
      include: [{ model: Menu, as: "Menu", attributes: ["id", "name", "slug"] }],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({ success: true, data: video || null });
  } catch (err) {
    log.error(MODULE, "byMenuSlug", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/** Public: the single video flagged to appear on the landing page (or null). */
exports.landingVideo = async (_req, res) => {
  try {
    const video = await Video.findOne({
      where: {
        show_on_landing: true,
        is_deleted: false,
        is_active: true,
        status: "active",
      },
      attributes: ["id", "title", "description", "file_path", "thumbnail", "created_at"],
      order: [["updated_at", "DESC"]],
    });
    return res.status(200).json({ success: true, data: video || null });
  } catch (err) {
    log.error(MODULE, "landingVideo", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const video = await Video.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found." });
    }

    video.is_deleted = true;
    video.is_active = false;
    await video.save();

    log.info(MODULE, "remove", { userId: req.user.id, videoId: video.id });

    return res.status(200).json({ success: true, message: "Video deleted successfully." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
