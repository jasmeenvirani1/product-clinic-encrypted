const { RoleMenuPermission, Menu, Permission } = require("../models");

function checkPermission(menuSlug, permissionSlug) {
  return async (req, res, next) => {
    try {
      // Guard: role must be loaded by authenticate middleware
      if (!req.user || !req.user.role_id) {
        return res.status(403).json({ success: false, message: "No role assigned to this account." });
      }

      // Super admin bypasses all permission checks
      if (req.user.Role && req.user.Role.name === "super_admin") {
        return next();
      }

      const roleId = req.user.role_id;

      const menu = await Menu.findOne({ where: { slug: menuSlug } });
      if (!menu) {
        return res.status(403).json({ success: false, message: "Menu not found." });
      }

      const permission = await Permission.findOne({ where: { slug: permissionSlug } });
      if (!permission) {
        return res.status(403).json({ success: false, message: "Permission not found." });
      }

      const hasAccess = await RoleMenuPermission.findOne({
        where: {
          role_id: roleId,
          menu_id: menu.id,
          permission_id: permission.id,
        },
      });

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: "Permission check failed." });
    }
  };
}

module.exports = { checkPermission };
