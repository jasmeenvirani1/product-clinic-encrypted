const { AiModel } = require("../models");
const log = require("../utils/logger");

const MODULE = "AiModelController";

// Shared helper: resolve the stored base_url for a given model id string.
// Returns undefined when the model isn't found (caller decides the fallback),
// or null/"" for models that use the default OpenAI endpoint.
async function resolveBaseUrlForModel(modelId) {
  if (!modelId) return undefined;
  const row = await AiModel.findOne({
    where: { model: modelId, is_deleted: false },
    attributes: ["base_url"],
    order: [["is_active", "DESC"], ["id", "ASC"]],
  });
  return row ? (row.base_url || null) : undefined;
}
exports.resolveBaseUrlForModel = resolveBaseUrlForModel;

// GET /api/ai-models — shared list of ACTIVE models for the settings dropdowns
// (readable by any authenticated user: super-admin + tenants).
exports.listActive = async (_req, res) => {
  try {
    const models = await AiModel.findAll({
      where: { is_deleted: false, is_active: true },
      attributes: ["id", "name", "model", "provider", "base_url"],
      order: [["sort_order", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: models });
  } catch (err) {
    log.error(MODULE, "listActive", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/super-admin/ai-models — admin list (includes inactive).
exports.getAll = async (_req, res) => {
  try {
    const models = await AiModel.findAll({
      where: { is_deleted: false },
      order: [["sort_order", "ASC"], ["id", "ASC"]],
    });
    return res.status(200).json({ success: true, data: models });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, model, provider, base_url, is_active, sort_order } = req.body;
    if (!name || !model) {
      return res.status(400).json({ success: false, message: "name and model are required." });
    }
    const row = await AiModel.create({
      name: name.trim(),
      model: model.trim(),
      provider: (provider || "OpenAI").trim(),
      base_url: base_url ? base_url.trim() : null,
      is_active: is_active !== false,
      sort_order: Number.isFinite(+sort_order) ? +sort_order : 0,
    });
    log.info(MODULE, "create", { userId: req.user.id, aiModelId: row.id });
    return res.status(201).json({ success: true, message: "AI model created.", data: row });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await AiModel.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!row) return res.status(404).json({ success: false, message: "AI model not found." });

    const { name, model, provider, base_url, is_active, sort_order } = req.body;
    if (name !== undefined) row.name = name.trim();
    if (model !== undefined) row.model = model.trim();
    if (provider !== undefined) row.provider = (provider || "OpenAI").trim();
    if (base_url !== undefined) row.base_url = base_url ? base_url.trim() : null;
    if (is_active !== undefined) row.is_active = is_active;
    if (sort_order !== undefined && Number.isFinite(+sort_order)) row.sort_order = +sort_order;
    await row.save();

    log.info(MODULE, "update", { userId: req.user.id, aiModelId: row.id });
    return res.status(200).json({ success: true, message: "AI model updated.", data: row });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await AiModel.findOne({ where: { id: req.params.id, is_deleted: false } });
    if (!row) return res.status(404).json({ success: false, message: "AI model not found." });

    row.is_deleted = true;
    await row.save();

    log.info(MODULE, "remove", { userId: req.user.id, aiModelId: row.id });
    return res.status(200).json({ success: true, message: "AI model deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
