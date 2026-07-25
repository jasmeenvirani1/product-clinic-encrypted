require("dotenv").config();
const { sequelize, Menu, Permission, Role, RoleMenuPermission } = require("../models");

// Registers the tenant-side "Theme Settings" menu and grants tenant_admin
// view + edit so it appears in their sidebar and they can save colours.
// Idempotent — safe to re-run.
async function ensurePerm(roleId, menuId, permId) {
  await RoleMenuPermission.findOrCreate({
    where: { role_id: roleId, menu_id: menuId, permission_id: permId },
    defaults: { role_id: roleId, menu_id: menuId, permission_id: permId },
  });
}

(async () => {
  try {
    await sequelize.authenticate();

    // 1. Tenant menu entry → sidebar path resolves to /app/theme-settings.
    const [menu] = await Menu.findOrCreate({
      where: { slug: "app-theme-settings" },
      defaults: {
        name: "Theme Settings",
        slug: "app-theme-settings",
        icon: "Palette",
        sort_order: 25,
        is_active: true,
      },
    });

    // 2. Grant tenant_admin the permissions needed: view (show) + edit (save).
    const tenantAdmin = await Role.findOne({ where: { name: "tenant_admin" } });
    if (!tenantAdmin) {
      console.error("tenant_admin role not found.");
      process.exit(1);
    }

    const wanted = ["view", "edit"];
    const perms = await Permission.findAll({ where: { slug: wanted } });
    if (perms.length !== wanted.length) {
      console.error("Expected permissions not found:", wanted);
      process.exit(1);
    }

    for (const permission of perms) {
      await ensurePerm(tenantAdmin.id, menu.id, permission.id);
    }

    console.log("✓ Theme Settings menu seeded for tenant_admin (view + edit).");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
