const path = require("path");
const bcrypt = require("bcryptjs");
const { User, Role, Plan, RoleMenuPermission, Menu, Permission } = require("../models");
const log = require("../utils/logger");

const MODULE = "UserController";

const mapUploadedProofs = (files = []) =>
  files.map((f) => f.filename || path.basename((f.path || "").replace(/\\/g, "/")));
const mapSingleUploadedFile = (files = []) => {
  const file = files[0];
  if (!file) return null;
  return file.filename || path.basename((file.path || "").replace(/\\/g, "/"));
};
const deleteProofFile = (filename) => {
  if (!filename) return;
  const filePath = path.join(process.cwd(), "uploads", "proofs", filename);
  require("fs").unlink(filePath, (err) => {
    if (err) log.warn(MODULE, "deleteProofFile", { filename, error: err.message });
  });
};

const PLAN_INCLUDE = {
  model: Plan,
  attributes: [
    "id",
    "plan_name",
    "period",
    "monthly_price",
    "yearly_price",
    "campaign_count",
    "features",
    "is_active",
    "is_deleted",
  ],
};
const TENANT_INCLUDE = {
  model: User,
  as: "Tenant",
  attributes: ["id", "full_name", "email"],
};
const normalizePlanInput = async ({ plan_id, plan_period, plan_started_at, plan_expires_at }) => {
  if (!plan_id) {
    return {
      value: {
        plan_id: null,
        plan_period: null,
        plan_started_at: null,
        plan_expires_at: null,
        plan_access: {},
      },
    };
  }

  const selectedPlan = await Plan.findOne({ where: { id: plan_id, is_deleted: false } });
  if (!selectedPlan || !selectedPlan.is_active) {
    return { error: "Selected plan is invalid or inactive." };
  }

  const period = plan_period === "yearly" ? "yearly" : "monthly";

  let startedAt = plan_started_at ? new Date(plan_started_at) : new Date();
  if (Number.isNaN(startedAt.getTime())) {
    return { error: "plan_started_at is invalid." };
  }

  let expiresAt = plan_expires_at ? new Date(plan_expires_at) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return { error: "plan_expires_at is invalid." };
  }

  if (!expiresAt) {
    const calculated = new Date(startedAt);
    if (period === "yearly") calculated.setFullYear(calculated.getFullYear() + 1);
    else calculated.setMonth(calculated.getMonth() + 1);
    expiresAt = calculated;
  }

  if (expiresAt <= startedAt) {
    return { error: "plan_expires_at must be greater than plan_started_at." };
  }

  return {
    value: {
      plan_id: selectedPlan.id,
      plan_period: period,
      plan_started_at: startedAt,
      plan_expires_at: expiresAt,
      plan_access: {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.plan_name,
        period,
        campaign_count: selectedPlan.campaign_count,
        features: selectedPlan.features || [],
      },
    },
  };
};

exports.getTenantAdmins = async (req, res) => {
  try {
    log.info(MODULE, "getTenantAdmins", { userId: req.user.id });

    const tenantAdminRole = await Role.findOne({ where: { name: "tenant_admin" } });
    if (!tenantAdminRole) {
      log.warn(MODULE, "getTenantAdmins", { message: "tenant_admin role not found" });
      return res.status(200).json({ success: true, data: [] });
    }

    const users = await User.findAll({
      where: { role_id: tenantAdminRole.id, is_deleted: false },
      attributes: { exclude: ["password_hash"] },
      include: [{ model: Role, attributes: ["id", "name"] }, PLAN_INCLUDE, TENANT_INCLUDE],
      order: [["id", "ASC"]],
    });

    log.info(MODULE, "getTenantAdmins", { resultCount: users.length });
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    log.error(MODULE, "getTenantAdmins", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getAll = async (req, res) => {
  try {
    log.info(MODULE, "getAll", { userId: req.user.id, role: req.user.Role?.name });

    const where = { is_deleted: false };

    const menu = await Menu.findOne({ where: { slug: "users" } });
    const viewAllPerm = await Permission.findOne({ where: { slug: "view_all" } });

    const hasViewAll =
      (req.user.Role && req.user.Role.name === "super_admin") ||
      (menu &&
        viewAllPerm &&
        (await RoleMenuPermission.findOne({
          where: {
            role_id: req.user.role_id,
            menu_id: menu.id,
            permission_id: viewAllPerm.id,
          },
        })));

    if (!hasViewAll) {
      where.tenant_id = req.user.id;
    }

    log.info(MODULE, "getAll", { hasViewAll: !!hasViewAll, filter: where });

    const users = await User.findAll({
      where,
      attributes: { exclude: ["password_hash"] },
      include: [{ model: Role, attributes: ["id", "name"] }, PLAN_INCLUDE, TENANT_INCLUDE],
      order: [["id", "ASC"]],
    });

    log.info(MODULE, "getAll", { resultCount: users.length });
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getById = async (req, res) => {
  try {
    log.info(MODULE, "getById", { userId: req.user.id, targetId: req.params.id });

    const user = await User.findOne({
      where: { id: req.params.id, is_deleted: false },
      attributes: { exclude: ["password_hash"] },
      include: [{ model: Role, attributes: ["id", "name"] }, PLAN_INCLUDE, TENANT_INCLUDE],
    });
    if (!user) {
      log.warn(MODULE, "getById", { targetId: req.params.id, message: "User not found" });
      return res.status(404).json({ success: false, message: "User not found." });
    }

    log.info(MODULE, "getById", { targetId: req.params.id, found: true });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      full_name,
      email,
      mobile,
      password,
      role_id,
      tenant_id,
      clinic_name,
      plan_id,
      plan_period,
      plan_started_at,
      plan_expires_at,
    } = req.body;

    const idProofFiles = mapUploadedProofs(req.files?.id_proof || []);
    const addressProofFiles = mapUploadedProofs(req.files?.address_proof || []);
    const profilePhoto = mapSingleUploadedFile(req.files?.profile_photo || []);

    log.info(MODULE, "create", { userId: req.user.id, email, role_id, tenant_id, plan_id });

    if (!full_name || !email || !password || !role_id) {
      log.warn(MODULE, "create", { message: "Missing required fields" });
      return res.status(400).json({
        success: false,
        message: "full_name, email, password and role_id are required.",
      });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase().trim(), is_deleted: false } });
    if (existing) {
      log.warn(MODULE, "create", { email, message: "Email already registered" });
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    const normalizedPlan = await normalizePlanInput({
      plan_id,
      plan_period,
      plan_started_at,
      plan_expires_at,
    });
    if (normalizedPlan.error) {
      return res.status(400).json({ success: false, message: normalizedPlan.error });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const created = await User.create({
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      mobile: mobile || null,
      password_hash,
      role_id,
      tenant_id: tenant_id || null,
      clinic_name: clinic_name || null,
      plan_id: normalizedPlan.value.plan_id,
      plan_period: normalizedPlan.value.plan_period,
      plan_started_at: normalizedPlan.value.plan_started_at,
      plan_expires_at: normalizedPlan.value.plan_expires_at,
      plan_access: normalizedPlan.value.plan_access,
      is_active: true,
      email_verified: true,
      id_proof: idProofFiles,
      address_proof: addressProofFiles,
      profile_photo: profilePhoto,
    });

    const user = await User.findByPk(created.id, {
      attributes: { exclude: ["password_hash"] },
      include: [{ model: Role, attributes: ["id", "name"] }, PLAN_INCLUDE, TENANT_INCLUDE],
    });

    log.info(MODULE, "create", { createdUserId: created.id, email });
    return res.status(201).json({ success: true, message: "User created.", data: user });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    log.info(MODULE, "update", { userId: req.user.id, targetId: req.params.id, body: req.body });

    const user = await User.findByPk(req.params.id, {
      include: [{ model: Role, attributes: ["id", "name"] }],
    });
    if (!user) {
      log.warn(MODULE, "update", { targetId: req.params.id, message: "User not found" });
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const {
      full_name,
      mobile,
      role_id,
      is_active,
      password,
      tenant_id,
      clinic_name,
      plan_id,
      plan_period,
      plan_started_at,
      plan_expires_at,
      remove_profile_photo,
    } = req.body;

    const idProofFiles = mapUploadedProofs(req.files?.id_proof || []);
    const addressProofFiles = mapUploadedProofs(req.files?.address_proof || []);
    const profilePhoto = mapSingleUploadedFile(req.files?.profile_photo || []);

    if (is_active === false && user.Role?.name === "super_admin") {
      log.warn(MODULE, "update", { targetId: req.params.id, message: "Attempt to deactivate super_admin" });
      return res.status(400).json({ success: false, message: "Super admin accounts cannot be deactivated." });
    }

    if (full_name !== undefined) user.full_name = full_name.trim();
    if (mobile !== undefined) user.mobile = mobile;
    if (role_id !== undefined) user.role_id = role_id;
    if (is_active !== undefined) user.is_active = is_active;
    if (tenant_id !== undefined) user.tenant_id = tenant_id;
    if (clinic_name !== undefined) user.clinic_name = clinic_name || null;
    if (password) user.password_hash = await bcrypt.hash(password, 10);
    if (idProofFiles.length) user.id_proof = [...(Array.isArray(user.id_proof) ? user.id_proof : []), ...idProofFiles];
    if (addressProofFiles.length) {
      user.address_proof = [...(Array.isArray(user.address_proof) ? user.address_proof : []), ...addressProofFiles];
    }
    if (String(remove_profile_photo) === "true") {
      deleteProofFile(user.profile_photo);
      user.profile_photo = null;
    }
    if (profilePhoto) {
      if (user.profile_photo && user.profile_photo !== profilePhoto) deleteProofFile(user.profile_photo);
      user.profile_photo = profilePhoto;
    }

    if (plan_id !== undefined || plan_period !== undefined || plan_started_at !== undefined || plan_expires_at !== undefined) {
      const normalizedPlan = await normalizePlanInput({
        plan_id: plan_id !== undefined ? plan_id : user.plan_id,
        plan_period: plan_period !== undefined ? plan_period : user.plan_period,
        plan_started_at: plan_started_at !== undefined ? plan_started_at : user.plan_started_at,
        plan_expires_at: plan_expires_at !== undefined ? plan_expires_at : user.plan_expires_at,
      });
      if (normalizedPlan.error) {
        return res.status(400).json({ success: false, message: normalizedPlan.error });
      }

      user.plan_id = normalizedPlan.value.plan_id;
      user.plan_period = normalizedPlan.value.plan_period;
      user.plan_started_at = normalizedPlan.value.plan_started_at;
      user.plan_expires_at = normalizedPlan.value.plan_expires_at;
      user.plan_access = normalizedPlan.value.plan_access;
    }

    await user.save();

    const updated = await User.findByPk(user.id, {
      attributes: { exclude: ["password_hash"] },
      include: [{ model: Role, attributes: ["id", "name"] }, PLAN_INCLUDE, TENANT_INCLUDE],
    });

    log.info(MODULE, "update", { targetId: req.params.id, message: "User updated" });
    return res.status(200).json({ success: true, message: "User updated.", data: updated });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    log.info(MODULE, "remove", { userId: req.user.id, targetId: req.params.id });

    if (String(req.params.id) === String(req.user.id)) {
      log.warn(MODULE, "remove", { message: "Self-deletion attempted" });
      return res.status(400).json({ success: false, message: "Cannot delete your own account." });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      log.warn(MODULE, "remove", { targetId: req.params.id, message: "User not found" });
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.is_deleted = true;
    user.is_active = false;
    await user.save();

    log.info(MODULE, "remove", { targetId: req.params.id, message: "User soft deleted" });
    return res.status(200).json({ success: true, message: "User deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { type, filename } = req.body;
    log.info(MODULE, "deleteDocument", { userId: req.user.id, targetId: req.params.id, type, filename });

    if (!["id_proof", "address_proof"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid document type." });
    }
    if (!filename || typeof filename !== "string") {
      return res.status(400).json({ success: false, message: "Filename is required." });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      log.warn(MODULE, "deleteDocument", { targetId: req.params.id, message: "User not found" });
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const current = Array.isArray(user[type]) ? [...user[type]] : [];
    const updated = current.filter((f) => f !== filename);
    if (updated.length === current.length) {
      return res.status(404).json({ success: false, message: "Document not found on this user." });
    }

    user[type] = updated;
    await user.save();

    deleteProofFile(filename);

    const result = await User.findByPk(user.id, {
      attributes: { exclude: ["password_hash"] },
      include: [{ model: Role, attributes: ["id", "name"] }, PLAN_INCLUDE, TENANT_INCLUDE],
    });

    log.info(MODULE, "deleteDocument", { targetId: req.params.id, type, filename, message: "Document deleted" });
    return res.status(200).json({ success: true, message: "Document deleted.", data: result });
  } catch (err) {
    log.error(MODULE, "deleteDocument", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};


