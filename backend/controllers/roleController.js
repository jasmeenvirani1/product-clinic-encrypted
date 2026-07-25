const { Role, RoleMenuPermission, Menu, Permission } = require("../models");
const log = require("../utils/logger");

const MODULE = "RoleController";

// ─── Create role ────────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;

    log.info(MODULE, "create", { userId: req.user.id, name });

    if (!name) {
      log.warn(MODULE, "create", { message: "Missing role name" });
      return res.status(400).json({ success: false, message: "Role name is required." });
    }

    const existing = await Role.findOne({ where: { name: name.toLowerCase().trim() } });
    if (existing) {
      log.warn(MODULE, "create", { name, message: "Role already exists" });
      return res.status(409).json({ success: false, message: "Role already exists." });
    }

    const role = await Role.create({
      name: name.toLowerCase().trim(),
      description: description || null,
    });

    log.info(MODULE, "create", { roleId: role.id, name: role.name, message: "Role created" });
    return res.status(201).json({ success: true, message: "Role created.", data: role });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get all roles ──────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    log.info(MODULE, "getAll", { userId: req.user.id });

    const roles = await Role.findAll({ order: [["id", "ASC"]] });

    log.info(MODULE, "getAll", { resultCount: roles.length });
    return res.status(200).json({ success: true, data: roles });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get single role with its menu permissions ──────────────────────
exports.getById = async (req, res) => {
  try {
    log.info(MODULE, "getById", { userId: req.user.id, targetId: req.params.id });

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      log.warn(MODULE, "getById", { targetId: req.params.id, message: "Role not found" });
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    const menuPermissions = await RoleMenuPermission.findAll({
      where: { role_id: role.id },
      include: [
        { model: Menu, attributes: ["id", "name", "slug"] },
        { model: Permission, attributes: ["id", "name", "slug"] },
      ],
    });

    log.info(MODULE, "getById", { targetId: req.params.id, found: true });
    return res.status(200).json({ success: true, data: { role, menuPermissions } });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update role ────────────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    log.info(MODULE, "update", { userId: req.user.id, targetId: req.params.id, body: req.body });

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      log.warn(MODULE, "update", { targetId: req.params.id, message: "Role not found" });
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    const { name, description, is_active } = req.body;
    if (name) role.name = name.toLowerCase().trim();
    if (description !== undefined) role.description = description;
    if (is_active !== undefined) role.is_active = is_active;
    await role.save();

    log.info(MODULE, "update", { targetId: req.params.id, message: "Role updated" });
    return res.status(200).json({ success: true, message: "Role updated.", data: role });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Delete role ────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    log.info(MODULE, "remove", { userId: req.user.id, targetId: req.params.id });

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      log.warn(MODULE, "remove", { targetId: req.params.id, message: "Role not found" });
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    await RoleMenuPermission.destroy({ where: { role_id: role.id } });
    await role.destroy();

    log.info(MODULE, "remove", { targetId: req.params.id, message: "Role deleted" });
    return res.status(200).json({ success: true, message: "Role deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Assign menu permissions to a role ──────────────────────────────
// Body: { permissions: [{ menu_id: 1, permission_ids: [1,2,3] }, ...] }
exports.assignPermissions = async (req, res) => {
  try {
    const roleId = req.params.id;

    log.info(MODULE, "assignPermissions", { userId: req.user.id, roleId, body: req.body });

    const role = await Role.findByPk(roleId);
    if (!role) {
      log.warn(MODULE, "assignPermissions", { roleId, message: "Role not found" });
      return res.status(404).json({ success: false, message: "Role not found." });
    }

    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      log.warn(MODULE, "assignPermissions", { message: "permissions array is required" });
      return res.status(400).json({ success: false, message: "permissions array is required." });
    }

    // Remove existing permissions for this role
    await RoleMenuPermission.destroy({ where: { role_id: roleId } });

    // Create new entries
    const records = [];
    for (const item of permissions) {
      for (const permId of item.permission_ids) {
        records.push({
          role_id: roleId,
          menu_id: item.menu_id,
          permission_id: permId,
        });
      }
    }

    if (records.length > 0) {
      await RoleMenuPermission.bulkCreate(records);
    }

    log.info(MODULE, "assignPermissions", { roleId, recordsCount: records.length, message: "Permissions assigned" });
    return res.status(200).json({ success: true, message: "Permissions assigned successfully." });
  } catch (err) {
    log.error(MODULE, "assignPermissions", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
