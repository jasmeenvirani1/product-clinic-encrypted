const { SeoSetting } = require("../models");
const log = require("../utils/logger");

const MODULE = "SeoSettingController";

// GET /api/public/seo-settings/:pageKey — consumed by the public site's
// generateMetadata() calls (no auth). Must be null-safe: always HTTP 200,
// data: null if missing/inactive, so the fail-open consumer logic never
// needs to branch on status codes.
exports.getPublic = async (req, res) => {
  try {
    const { pageKey } = req.params;
    const setting = await SeoSetting.findOne({
      where: { page_key: pageKey, is_active: true },
    });
    return res.status(200).json({ success: true, data: setting || null });
  } catch (err) {
    log.error(MODULE, "getPublic", { error: err.message });
    return res.status(200).json({ success: true, data: null });
  }
};

// GET /api/super-admin/seo-settings — admin list (includes inactive).
exports.getAll = async (_req, res) => {
  try {
    const settings = await SeoSetting.findAll({
      order: [["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: settings });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      page_key,
      meta_title,
      meta_description,
      og_title,
      og_description,
      og_image,
      canonical_url,
      keywords,
      is_active,
    } = req.body;

    if (!page_key) {
      return res.status(400).json({ success: false, message: "page_key is required." });
    }

    const existing = await SeoSetting.findOne({ where: { page_key: page_key.trim() } });
    if (existing) {
      return res.status(400).json({ success: false, message: "page_key already exists." });
    }

    const setting = await SeoSetting.create({
      page_key: page_key.trim(),
      meta_title: meta_title ?? null,
      meta_description: meta_description ?? null,
      og_title: og_title ?? null,
      og_description: og_description ?? null,
      og_image: og_image ?? null,
      canonical_url: canonical_url ?? null,
      keywords: keywords ?? null,
      is_active: is_active !== false,
    });

    log.info(MODULE, "create", { userId: req.user.id, settingId: setting.id });
    return res.status(201).json({ success: true, message: "SEO setting created.", data: setting });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const setting = await SeoSetting.findOne({ where: { id: req.params.id } });
    if (!setting) return res.status(404).json({ success: false, message: "SEO setting not found." });

    const {
      meta_title,
      meta_description,
      og_title,
      og_description,
      og_image,
      canonical_url,
      keywords,
      is_active,
    } = req.body;

    if (meta_title !== undefined) setting.meta_title = meta_title;
    if (meta_description !== undefined) setting.meta_description = meta_description;
    if (og_title !== undefined) setting.og_title = og_title;
    if (og_description !== undefined) setting.og_description = og_description;
    if (og_image !== undefined) setting.og_image = og_image;
    if (canonical_url !== undefined) setting.canonical_url = canonical_url;
    if (keywords !== undefined) setting.keywords = keywords;
    if (is_active !== undefined) setting.is_active = is_active;
    await setting.save();

    log.info(MODULE, "update", { userId: req.user.id, settingId: setting.id });
    return res.status(200).json({ success: true, message: "SEO setting updated.", data: setting });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Hard delete — deliberate deviation from LandingFaq's soft-delete pattern.
// SeoSetting is meant to hold exactly one row per page_key; no is_deleted column exists.
exports.remove = async (req, res) => {
  try {
    const setting = await SeoSetting.findOne({ where: { id: req.params.id } });
    if (!setting) return res.status(404).json({ success: false, message: "SEO setting not found." });

    await setting.destroy();

    log.info(MODULE, "remove", { userId: req.user.id, settingId: req.params.id });
    return res.status(200).json({ success: true, message: "SEO setting deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
