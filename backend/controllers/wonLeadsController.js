const { Op } = require("sequelize");
const { Lead, Conversation, User, Invoice, Role } = require("../models");
const log = require("../utils/logger");

const MODULE = "WonLeadsController";

function buildInvoiceNumber() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Date.now().toString().slice(-6)}`;
}

// ─── GET /api/won-leads ──────────────────────────────────────────────────────
// Super admin → all tenants (includes clinic name)
// Tenant admin → only their own won leads
exports.getWonLeads = async (req, res) => {
  try {
    const user = req.user;
    const role = user.Role?.name;

    const where = { stage: "won", is_deleted: false };

    if (role === "tenant_admin") {
      where.created_by = user.id;
    }

    const leads = await Lead.findAll({
      where,
      include: [
        {
          model: Conversation,
          where: { is_deleted: false },
          required: false,
          attributes: ["id", "channel", "status", "last_message_at"],
          separate: false,
        },
        {
          model: User,
          as: "CreatedByUser",
          attributes: ["id", "full_name", "clinic_name", "email"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });

    const rows = leads.map((lead) => {
      const conversations = lead.Conversations ?? [];
      const latestConv = conversations.sort(
        (a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
      )[0] ?? null;

      const row = {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        conversations: conversations.map((c) => ({
          id: c.id,
          channel: c.channel,
          status: c.status,
        })),
        latest_conversation_id: latestConv?.id ?? null,
        booked_at: lead.updatedAt,
      };

      if (role === "super_admin") {
        row.clinic_name =
          lead.CreatedByUser?.clinic_name ||
          lead.CreatedByUser?.full_name ||
          lead.CreatedByUser?.email ||
          "—";
        row.tenant_id = lead.CreatedByUser?.id ?? lead.tenant_id ?? null;
      }

      return row;
    });

    log.info(MODULE, "getWonLeads", { userId: user.id, role, count: rows.length });

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    log.error(MODULE, "getWonLeads", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── POST /api/won-leads/:leadId/invoice (super admin only) ──────────────────
exports.generateInvoice = async (req, res) => {
  try {
    const user = req.user;
    const role = user.Role?.name;

    if (role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden." });
    }

    const leadId = parseInt(req.params.leadId, 10);
    if (!leadId) return res.status(400).json({ success: false, message: "Invalid lead ID." });

    const { amount = 0, currency = "USD", notes = "" } = req.body ?? {};

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ success: false, message: "Amount must be a valid non-negative number." });
    }

    const lead = await Lead.findOne({
      where: { id: leadId, stage: "won", is_deleted: false },
      include: [{ model: User, as: "CreatedByUser", attributes: ["id"] }],
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: "Won lead not found." });
    }

    const tenantId = lead.CreatedByUser?.id ?? lead.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "No tenant associated with this lead." });
    }

    const invoice = await Invoice.create({
      invoice_number: buildInvoiceNumber(),
      lead_id: leadId,
      tenant_id: tenantId,
      generated_by: user.id,
      amount: parsedAmount,
      currency,
      status: "sent",
      notes: notes || null,
    });

    log.info(MODULE, "generateInvoice", { userId: user.id, leadId, invoiceId: invoice.id });

    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    log.error(MODULE, "generateInvoice", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── GET /api/won-leads/invoices (tenant admin → own; super admin → all) ─────
exports.getInvoices = async (req, res) => {
  try {
    const user = req.user;
    const role = user.Role?.name;

    const where = { is_deleted: false };

    if (role === "tenant_admin") {
      where.tenant_id = user.id;
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        {
          model: Lead,
          as: "Lead",
          attributes: ["id", "name", "phone"],
        },
        {
          model: User,
          as: "Tenant",
          attributes: ["id", "full_name", "clinic_name", "email"],
        },
        {
          model: User,
          as: "GeneratedBy",
          attributes: ["id", "full_name"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    log.info(MODULE, "getInvoices", { userId: user.id, role, count: invoices.length });

    return res.status(200).json({ success: true, data: invoices });
  } catch (err) {
    log.error(MODULE, "getInvoices", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
