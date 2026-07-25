const { CustomField } = require("../models");

const VALID_TABLES = ["leads", "conversations", "campaigns"];
const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

exports.getAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.table_name) where.table_name = req.query.table_name;
    const fields = await CustomField.findAll({
      where,
      order: [["sort_order", "ASC"], ["id", "ASC"]],
    });
    return res.json({ success: true, data: fields });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { table_name, field_key, label, field_type, options, is_required, sort_order } = req.body;

    if (!VALID_TABLES.includes(table_name)) {
      return res.status(400).json({ success: false, message: `table_name must be one of: ${VALID_TABLES.join(", ")}` });
    }
    if (!field_key || !FIELD_KEY_RE.test(field_key)) {
      return res.status(400).json({ success: false, message: "field_key must be snake_case (lowercase letters, digits, underscores)." });
    }
    if (!label || !label.trim()) {
      return res.status(400).json({ success: false, message: "label is required." });
    }

    const existing = await CustomField.findOne({ where: { table_name, field_key } });
    if (existing) {
      return res.status(409).json({ success: false, message: `Field key "${field_key}" already exists for table "${table_name}".` });
    }

    const field = await CustomField.create({
      table_name,
      field_key,
      label: label.trim(),
      field_type: field_type || "text",
      options: Array.isArray(options) ? options : [],
      is_required: Boolean(is_required),
      sort_order: Number(sort_order) || 0,
      is_active: true,
    });

    return res.status(201).json({ success: true, data: field });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const field = await CustomField.findByPk(req.params.id);
    if (!field) return res.status(404).json({ success: false, message: "Field not found." });

    const { label, field_type, options, is_required, sort_order, is_active } = req.body;

    if (label !== undefined)      field.label       = label.trim();
    if (field_type !== undefined)  field.field_type  = field_type;
    if (options !== undefined)     field.options     = Array.isArray(options) ? options : [];
    if (is_required !== undefined) field.is_required = Boolean(is_required);
    if (sort_order !== undefined)  field.sort_order  = Number(sort_order);
    if (is_active !== undefined)   field.is_active   = Boolean(is_active);

    await field.save();
    return res.json({ success: true, data: field });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Soft-deactivate (not hard-delete) so existing data references stay intact
exports.remove = async (req, res) => {
  try {
    const field = await CustomField.findByPk(req.params.id);
    if (!field) return res.status(404).json({ success: false, message: "Field not found." });
    field.is_active = false;
    await field.save();
    return res.json({ success: true, message: "Field deactivated." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
