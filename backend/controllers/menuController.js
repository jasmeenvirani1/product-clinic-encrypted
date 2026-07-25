const { Menu } = require("../models");
const log = require("../utils/logger");

const MODULE = "MenuController";

// ─── Create menu ────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, slug, icon, parent_id, sort_order } = req.body;

    log.info(MODULE, "create", { userId: req.user.id, name, slug });

    if (!name || !slug) {
      log.warn(MODULE, "create", { message: "Missing name or slug" });
      return res.status(400).json({ success: false, message: "name and slug are required." });
    }

    const existing = await Menu.findOne({ where: { slug: slug.toLowerCase().trim() } });
    if (existing) {
      log.warn(MODULE, "create", { slug, message: "Menu slug already exists" });
      return res.status(409).json({ success: false, message: "Menu slug already exists." });
    }

    const menu = await Menu.create({
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      icon: icon || null,
      parent_id: parent_id || null,
      sort_order: sort_order || 0,
    });

    log.info(MODULE, "create", { menuId: menu.id, slug: menu.slug, message: "Menu created" });
    return res.status(201).json({ success: true, message: "Menu created.", data: menu });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get all menus (tree structure) ─────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    log.info(MODULE, "getAll", { userId: req.user.id });

    const menus = await Menu.findAll({
      where: { parent_id: null },
      include: [
        {
          model: Menu,
          as: "children",
          include: [{ model: Menu, as: "children" }],
        },
      ],
      order: [
        ["sort_order", "ASC"],
        [{ model: Menu, as: "children" }, "sort_order", "ASC"],
      ],
    });

    log.info(MODULE, "getAll", { resultCount: menus.length });
    return res.status(200).json({ success: true, data: menus });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get flat list of all menus ─────────────────────────────────────
exports.getAllFlat = async (req, res) => {
  try {
    log.info(MODULE, "getAllFlat", { userId: req.user.id });

    const menus = await Menu.findAll({ order: [["sort_order", "ASC"]] });

    log.info(MODULE, "getAllFlat", { resultCount: menus.length });
    return res.status(200).json({ success: true, data: menus });
  } catch (err) {
    log.error(MODULE, "getAllFlat", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update menu ────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    log.info(MODULE, "update", { userId: req.user.id, targetId: req.params.id, body: req.body });

    const menu = await Menu.findByPk(req.params.id);
    if (!menu) {
      log.warn(MODULE, "update", { targetId: req.params.id, message: "Menu not found" });
      return res.status(404).json({ success: false, message: "Menu not found." });
    }

    const { name, slug, icon, parent_id, sort_order, is_active } = req.body;
    if (name) menu.name = name.trim();
    if (slug) menu.slug = slug.toLowerCase().trim();
    if (icon !== undefined) menu.icon = icon;
    if (parent_id !== undefined) menu.parent_id = parent_id;
    if (sort_order !== undefined) menu.sort_order = sort_order;
    if (is_active !== undefined) menu.is_active = is_active;
    await menu.save();

    log.info(MODULE, "update", { targetId: req.params.id, message: "Menu updated" });
    return res.status(200).json({ success: true, message: "Menu updated.", data: menu });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Delete menu ────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    log.info(MODULE, "remove", { userId: req.user.id, targetId: req.params.id });

    const menu = await Menu.findByPk(req.params.id);
    if (!menu) {
      log.warn(MODULE, "remove", { targetId: req.params.id, message: "Menu not found" });
      return res.status(404).json({ success: false, message: "Menu not found." });
    }

    await menu.destroy();

    log.info(MODULE, "remove", { targetId: req.params.id, message: "Menu deleted" });
    return res.status(200).json({ success: true, message: "Menu deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
