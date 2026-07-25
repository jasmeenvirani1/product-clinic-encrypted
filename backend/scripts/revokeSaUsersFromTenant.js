require("dotenv").config();
const { sequelize, Menu, Role, RoleMenuPermission } = require("../models");

// The "SA Users" menu (slug: users) is a super-admin-only screen. It was
// mistakenly granted to tenant_admin, which surfaced a stray "User Management"
// item in the tenant sidebar. Tenants manage their own staff via "Team
// Management" (app-team), so revoke every tenant_admin grant on this menu.
// Idempotent — safe to re-run.
(async () => {
  try {
    await sequelize.authenticate();

    const tenantAdmin = await Role.findOne({ where: { name: "tenant_admin" } });
    const menu = await Menu.findOne({ where: { slug: "users" } });

    if (!tenantAdmin) { console.error("tenant_admin role not found."); process.exit(1); }
    if (!menu) { console.log("No 'users' menu found — nothing to revoke."); process.exit(0); }

    const removed = await RoleMenuPermission.destroy({
      where: { role_id: tenantAdmin.id, menu_id: menu.id },
    });

    console.log(`✓ Revoked ${removed} 'users' menu permission(s) from tenant_admin.`);
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
