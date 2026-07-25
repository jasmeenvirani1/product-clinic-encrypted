const path = require("path");
const { SupportTicket, User } = require("../models");
const log = require("../utils/logger");

const MODULE = "SupportController";

// Ensure both camelCase and snake_case timestamp keys are present in the
// JSON payload, regardless of Sequelize's getter behavior. Frontend types
// rely on createdAt/updatedAt; some places read created_at directly.
function serializeTicket(ticket) {
  if (!ticket) return ticket;
  const json = typeof ticket.toJSON === "function" ? ticket.toJSON() : { ...ticket };
  const createdAt = json.createdAt || json.created_at || ticket.get?.("created_at") || null;
  const updatedAt = json.updatedAt || json.updated_at || ticket.get?.("updated_at") || null;
  return { ...json, createdAt, updatedAt, created_at: createdAt, updated_at: updatedAt };
}

const TICKET_INCLUDE = [
  {
    model: User,
    as: "CreatedByUser",
    attributes: ["id", "full_name", "email"],
  },
];

function getTenantScopeId(user) {
  const role = user?.Role?.name;
  if (role === "super_admin") return user.id;
  return user.tenant_id || user.id;
}

exports.getAll = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);
    log.info(MODULE, "getAll", { userId: req.user.id, role, tenantScopeId });

    const where = { is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
    }

    const tickets = await SupportTicket.findAll({
      where,
      include: TICKET_INCLUDE,
      order: [["created_at", "DESC"]],
    });

    return res.json({ success: true, data: tickets.map(serializeTicket) });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getById = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);
    log.info(MODULE, "getById", { userId: req.user.id, ticketId: req.params.id, tenantScopeId });

    const where = { id: req.params.id, is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
    }

    const ticket = await SupportTicket.findOne({ where, include: TICKET_INCLUDE });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    return res.json({ success: true, data: serializeTicket(ticket) });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);
    log.info(MODULE, "create", { userId: req.user.id, role, tenantScopeId });

    const { subject, description } = req.body;
    if (!subject) {
      return res.status(400).json({ success: false, message: "Subject is required." });
    }

    const attachment = req.file ? (req.file.filename || path.basename(req.file.path || "")) : null;

    const ticket = await SupportTicket.create({
      subject,
      description,
      attachment,
      created_by: req.user.id,
      tenant_id: tenantScopeId,
    });

    return res.status(201).json({ success: true, message: "Ticket created.", data: serializeTicket(ticket) });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);
    log.info(MODULE, "update", { userId: req.user.id, ticketId: req.params.id, tenantScopeId });

    const where = { id: req.params.id, is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
    }

    const ticket = await SupportTicket.findOne({ where });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    const { subject, description, status } = req.body;
    if (subject !== undefined) ticket.subject = subject;
    if (description !== undefined) ticket.description = description;
    if (status !== undefined) ticket.status = status;
    if (req.file) {
      ticket.attachment = req.file.filename || path.basename(req.file.path || "");
    }

    await ticket.save();
    return res.json({ success: true, message: "Ticket updated.", data: serializeTicket(ticket) });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);
    log.info(MODULE, "remove", { userId: req.user.id, ticketId: req.params.id, tenantScopeId });

    const where = { id: req.params.id, is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
    }

    const ticket = await SupportTicket.findOne({ where });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    ticket.is_deleted = true;
    ticket.is_active = false;
    await ticket.save();

    return res.json({ success: true, message: "Ticket deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};


