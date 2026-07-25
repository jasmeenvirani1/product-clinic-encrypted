const { Lead, User, Role } = require("../models");
const log = require("../utils/logger");
const { triggerLeadSummary, generateLeadSummary } = require("../services/leadSummaryService");

const MODULE = "LeadController";
// Default scores for manual stage changes (midpoint of each band)
// Dynamic scoring applies when messages are processed via leadAutomation
const STAGE_SCORE_MAP = {
  new: 10,
  qualified: 25,
  discussion: 55,
  won: 85,
  lost: 5,
};

const STAGE_FLOOR = {
  new: 0,
  qualified: 20,
  discussion: 50,
  won: 80,
  lost: 0,
};

const LEAD_INCLUDE = [
  { model: User, as: "AssignedUser",   attributes: ["id", "full_name", "email"] },
  { model: User, as: "CreatedByUser",  attributes: ["id", "full_name"] },
];

const isAdmin = (user) =>
  user.Role?.name === "super_admin" || user.Role?.name === "tenant_admin";

const applyLeadScope = (where, user) => {
  const role = user.Role?.name;

  if (role === "super_admin") {
    return where;
  }

  if (role === "tenant_admin") {
    where.created_by = user.id;
    return where;
  }

  where.assigned_to = user.id;
  return where;
};

const getStageScore = (stage) => STAGE_SCORE_MAP[stage] ?? STAGE_SCORE_MAP.new;

const syncLeadScoreWithStage = async (lead) => {
  if (!lead) return lead;

  // Enforce stage floor only — preserve dynamically computed scores above the floor
  const floor = STAGE_FLOOR[lead.stage] ?? 0;
  if ((lead.score || 0) < floor) {
    lead.score = floor;
    await lead.save();
  }

  return lead;
};

const syncLeadCollectionScoresWithStage = async (leads = []) => {
  for (const lead of leads) {
    await syncLeadScoreWithStage(lead);
  }
  return leads;
};

// ─── Get assignable teammates ─────────────────────────────────────────
// Any authenticated user can call this to populate the "Assigned To" dropdown.
exports.getTeammates = async (req, res) => {
  try {
    log.info(MODULE, "getTeammates", { userId: req.user.id, role: req.user.Role?.name });

    const { Op } = require("sequelize");
    const where = { is_deleted: false, is_active: true };

    // Exclude super_admin and tenant_admin roles — only show staff users
    const excludedRoles = await Role.findAll({
      where: { name: { [Op.in]: ["super_admin", "tenant_admin"] } },
    });
    const excludedRoleIds = excludedRoles.map((r) => r.id);
    if (excludedRoleIds.length) {
      where.role_id = { [Op.notIn]: excludedRoleIds };
    }

    // non-super_admin: scope to same tenant only
    if (req.user.Role?.name !== "super_admin") {
      where.tenant_id = req.user.tenant_id || req.user.id;
    }

    const users = await User.findAll({
      where,
      attributes: ["id", "full_name", "email"],
      include: [{ model: Role, attributes: ["id", "name"] }],
      order: [["full_name", "ASC"]],
    });

    log.info(MODULE, "getTeammates", { resultCount: users.length });
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    log.error(MODULE, "getTeammates", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get all leads ────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    log.info(MODULE, "getAll", { userId: req.user.id, role: req.user.Role?.name });

    const where = applyLeadScope({ is_deleted: false }, req.user);

    // super_admin: optionally filter by tenant_id query param
    // Lead.tenant_id is always null, so we resolve the tenant's user IDs first
    // and filter leads by created_by instead.
    if (req.user.Role?.name === "super_admin" && req.query.tenant_id) {
      const { Op } = require("sequelize");
      const tenantId = parseInt(req.query.tenant_id, 10);
      if (!isNaN(tenantId)) {
        const tenantUsers = await User.findAll({
          where: {
            [Op.or]: [
              { id: tenantId },
              { tenant_id: tenantId },
            ],
            is_deleted: false,
          },
          attributes: ["id"],
        });
        const tenantUserIds = tenantUsers.map((u) => u.id);
        where.created_by = { [Op.in]: tenantUserIds.length ? tenantUserIds : [-1] };
      }
    }

    const leads = await Lead.findAll({
      where,
      include: LEAD_INCLUDE,
      order: [["created_at", "DESC"]],
    });

    await syncLeadCollectionScoresWithStage(leads);

    log.info(MODULE, "getAll", { resultCount: leads.length });
    return res.status(200).json({ success: true, data: leads });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get single lead ──────────────────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    log.info(MODULE, "getById", { userId: req.user.id, targetId: req.params.id });

    const where = applyLeadScope({ id: req.params.id, is_deleted: false }, req.user);

    // staff_user can only view leads assigned to them
    if (!isAdmin(req.user)) {
      where.assigned_to = req.user.id;
    }

    const lead = await Lead.findOne({ where, include: LEAD_INCLUDE });

    if (!lead) {
      log.warn(MODULE, "getById", { targetId: req.params.id, message: "Lead not found" });
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    await syncLeadScoreWithStage(lead);

    log.info(MODULE, "getById", { targetId: req.params.id, found: true });
    return res.status(200).json({ success: true, data: lead });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Create lead ──────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, phone, email, source, stage, city, score, notes, remark, last_message, assigned_to, custom_data } = req.body;

    log.info(MODULE, "create", { userId: req.user.id, name });

    if (!name) {
      log.warn(MODULE, "create", { message: "Missing required field: name" });
      return res.status(400).json({ success: false, message: "name is required." });
    }

    const normalizedStage = stage || "new";
    const normalizedRemark = remark?.trim() || null;
    if (normalizedStage === "lost" && !normalizedRemark) {
      return res.status(400).json({ success: false, message: "remark is required when stage is lost." });
    }

    // staff_user: always assign to themselves; only admins can choose assignee
    const resolvedAssignee = isAdmin(req.user)
      ? (assigned_to || null)
      : req.user.id;

    const created = await Lead.create({
      name:         name.trim(),
      phone:        phone?.trim() || null,
      email:        email?.toLowerCase().trim() || null,
      source:       source?.trim() || null,
      stage:        normalizedStage,
      city:         city?.trim() || null,
      score:        score ?? 0,
      notes:        notes?.trim() || null,
      remark:       normalizedRemark,
      last_message: last_message?.trim() || null,
      assigned_to:  resolvedAssignee,
      created_by:   req.user.id,
      tenant_id:    req.user.tenant_id || null,
      is_active:    true,
      custom_data:  (custom_data && typeof custom_data === "object") ? custom_data : {},
    });

    const lead = await Lead.findByPk(created.id, { include: LEAD_INCLUDE });

    log.info(MODULE, "create", { createdLeadId: created.id, name, assignedTo: resolvedAssignee });
    return res.status(201).json({ success: true, message: "Lead created.", data: lead });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update lead ──────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    log.info(MODULE, "update", { userId: req.user.id, targetId: req.params.id, body: req.body });

    const where = applyLeadScope({ id: req.params.id, is_deleted: false }, req.user);

    // staff_user can only update leads assigned to them
    if (!isAdmin(req.user)) {
      where.assigned_to = req.user.id;
    }

    const lead = await Lead.findOne({ where });
    if (!lead) {
      log.warn(MODULE, "update", { targetId: req.params.id, message: "Lead not found" });
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    const { name, phone, email, source, stage, city, score, notes, remark, last_message, assigned_to, is_active, custom_data } = req.body;

    // Won leads are permanently locked — no stage change allowed
    const normalizedRemark = remark !== undefined ? (remark?.trim() || null) : lead.remark;
    const normalizedStage = stage !== undefined ? stage : lead.stage;
    if (normalizedStage === "lost" && !normalizedRemark) {
      return res.status(400).json({ success: false, message: "remark is required when stage is lost." });
    }

    const prevStage = lead.stage; // capture BEFORE any field updates

    if (name         !== undefined) lead.name         = name.trim();
    if (phone        !== undefined) lead.phone        = phone?.trim() || null;
    if (email        !== undefined) lead.email        = email?.toLowerCase().trim() || null;
    if (source       !== undefined) lead.source       = source?.trim() || null;
    if (stage        !== undefined) lead.stage        = stage;
    if (city         !== undefined) lead.city         = city?.trim() || null;
    if (score        !== undefined) lead.score        = score;
    if (notes        !== undefined) lead.notes        = notes?.trim() || null;
    if (remark       !== undefined) lead.remark       = remark?.trim() || null;
    if (last_message !== undefined) lead.last_message = last_message?.trim() || null;
    if (is_active    !== undefined) lead.is_active    = is_active;

    // Only admins can reassign leads
    if (isAdmin(req.user) && assigned_to !== undefined) {
      lead.assigned_to = assigned_to || null;
    }

    // Merge custom field values (never replace wholesale)
    if (custom_data !== undefined && typeof custom_data === "object") {
      lead.custom_data = { ...(lead.custom_data ?? {}), ...custom_data };
    }

    if (stage !== undefined && score === undefined) {
      lead.score = getStageScore(lead.stage);
    }

    await lead.save();

    // Regenerate AI summary when stage changed manually
    if (stage !== undefined && stage !== prevStage) {
      triggerLeadSummary(lead.id, lead.created_by || lead.assigned_to);
    }

    const updated = await Lead.findByPk(lead.id, { include: LEAD_INCLUDE });

    log.info(MODULE, "update", { targetId: req.params.id, message: "Lead updated" });
    return res.status(200).json({ success: true, message: "Lead updated.", data: updated });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get AI summary history ───────────────────────────────────────────
exports.getSummaries = async (req, res) => {
  try {
    const { LeadSummary } = require("../models");
    const where = applyLeadScope({ id: req.params.id, is_deleted: false }, req.user);
    if (!isAdmin(req.user)) where.assigned_to = req.user.id;

    const lead = await Lead.findOne({ where });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });

    const summaries = await LeadSummary.findAll({
      where: { lead_id: lead.id },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({ success: true, data: summaries });
  } catch (err) {
    log.error(MODULE, "getSummaries", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Regenerate AI summary ────────────────────────────────────────────
exports.regenerateSummary = async (req, res) => {
  try {
    log.info(MODULE, "regenerateSummary", { userId: req.user.id, targetId: req.params.id });

    const where = applyLeadScope({ id: req.params.id, is_deleted: false }, req.user);
    if (!isAdmin(req.user)) where.assigned_to = req.user.id;

    const lead = await Lead.findOne({ where });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    await generateLeadSummary(lead.id, lead.created_by || lead.assigned_to);

    const updated = await Lead.findByPk(lead.id, { include: LEAD_INCLUDE });
    return res.status(200).json({ success: true, message: "Summary regenerated.", data: updated });
  } catch (err) {
    log.error(MODULE, "regenerateSummary", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Delete lead (soft) ───────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    log.info(MODULE, "remove", { userId: req.user.id, targetId: req.params.id });

    const where = applyLeadScope({ id: req.params.id, is_deleted: false }, req.user);

    // staff_user can only delete leads assigned to them
    if (!isAdmin(req.user)) {
      where.assigned_to = req.user.id;
    }

    const lead = await Lead.findOne({ where });
    if (!lead) {
      log.warn(MODULE, "remove", { targetId: req.params.id, message: "Lead not found" });
      return res.status(404).json({ success: false, message: "Lead not found." });
    }

    lead.is_deleted = true;
    lead.is_active  = false;
    await lead.save();

    log.info(MODULE, "remove", { targetId: req.params.id, message: "Lead soft deleted" });
    return res.status(200).json({ success: true, message: "Lead deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
