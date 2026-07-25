const { Permission } = require("../models");
const log = require("../utils/logger");

const MODULE = "PermissionController";

// ─── Create permission ──────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, slug } = req.body;

    log.info(MODULE, "create", { userId: req.user.id, name, slug });

    if (!name || !slug) {
      log.warn(MODULE, "create", { message: "Missing name or slug" });
      return res.status(400).json({ success: false, message: "name and slug are required." });
    }

    const existing = await Permission.findOne({ where: { slug: slug.toLowerCase().trim() } });
    if (existing) {
      log.warn(MODULE, "create", { slug, message: "Permission slug already exists" });
      return res.status(409).json({ success: false, message: "Permission slug already exists." });
    }

    const permission = await Permission.create({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
    });

    log.info(MODULE, "create", { permissionId: permission.id, slug: permission.slug, message: "Permission created" });
    return res.status(201).json({ success: true, message: "Permission created.", data: permission });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get all permissions ────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    log.info(MODULE, "getAll", { userId: req.user.id });

    const permissions = await Permission.findAll({ order: [["id", "ASC"]] });

    log.info(MODULE, "getAll", { resultCount: permissions.length });
    return res.status(200).json({ success: true, data: permissions });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update permission ──────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    log.info(MODULE, "update", { userId: req.user.id, targetId: req.params.id, body: req.body });

    const permission = await Permission.findByPk(req.params.id);
    if (!permission) {
      log.warn(MODULE, "update", { targetId: req.params.id, message: "Permission not found" });
      return res.status(404).json({ success: false, message: "Permission not found." });
    }

    const { name, slug } = req.body;
    if (name) permission.name = name.trim();
    if (slug) permission.slug = slug.toLowerCase().trim();
    await permission.save();

    log.info(MODULE, "update", { targetId: req.params.id, message: "Permission updated" });
    return res.status(200).json({ success: true, message: "Permission updated.", data: permission });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Delete permission ──────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    log.info(MODULE, "remove", { userId: req.user.id, targetId: req.params.id });

    const permission = await Permission.findByPk(req.params.id);
    if (!permission) {
      log.warn(MODULE, "remove", { targetId: req.params.id, message: "Permission not found" });
      return res.status(404).json({ success: false, message: "Permission not found." });
    }

    await permission.destroy();

    log.info(MODULE, "remove", { targetId: req.params.id, message: "Permission deleted" });
    return res.status(200).json({ success: true, message: "Permission deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
