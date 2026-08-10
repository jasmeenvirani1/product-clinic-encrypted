const { Op } = require("sequelize");
const { Notification } = require("../models");
const log = require("../utils/logger");

const MODULE = "NotificationController";

// "Belongs to me" = a row explicitly addressed to my user id, OR a row
// broadcast to my role (e.g. recipientRole: "super_admin"). Matches the
// targeting semantics already used by createNotification/creditAlertService.
function ownershipWhere(user) {
  const roleName = user.Role?.name || null;
  const clauses = [{ recipient_id: user.id }];
  if (roleName) clauses.push({ recipient_role: roleName });
  return { [Op.or]: clauses };
}

// GET /api/notifications?unread_only=true
exports.list = async (req, res) => {
  try {
    const where = { [Op.and]: [ownershipWhere(req.user)] };
    if (req.query.unread_only === "true") {
      where[Op.and].push({ is_read: false });
    }

    const rows = await Notification.findAll({
      where,
      order: [["is_read", "ASC"], ["created_at", "DESC"]],
      attributes: ["id", "type", "title", "body", "is_read", "meta", "created_at"],
    });

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    log.error(MODULE, "list", { error: err.message, userId: req.user?.id });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// PATCH /api/notifications/:id/read — idempotent, scoped to rows owned by
// the requesting user (same ownership rule as list()).
exports.markRead = async (req, res) => {
  try {
    const row = await Notification.findOne({
      where: { [Op.and]: [{ id: req.params.id }, ownershipWhere(req.user)] },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    if (!row.is_read) {
      row.is_read = true;
      await row.save();
    }

    return res.status(200).json({ success: true, data: { id: row.id, is_read: true } });
  } catch (err) {
    log.error(MODULE, "markRead", { error: err.message, userId: req.user?.id, id: req.params.id });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
