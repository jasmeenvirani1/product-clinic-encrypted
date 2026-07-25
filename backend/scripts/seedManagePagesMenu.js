require("dotenv").config();
const { sequelize, Menu, Permission, Role, RoleMenuPermission } = require("../models");

async function ensurePerm(roleId, menuId, permId) {
  await RoleMenuPermission.findOrCreate({
    where: { role_id: roleId, menu_id: menuId, permission_id: permId },
    defaults: { role_id: roleId, menu_id: menuId, permission_id: permId },
  });
}

(async () => {
  try {
    await sequelize.authenticate();

    const [menu] = await Menu.findOrCreate({
      where: { slug: "sa-manage-pages" },
      defaults: {
        name: "Manage Pages",
        slug: "sa-manage-pages",
        icon: "FileText",
        sort_order: 12,
        is_active: true,
      },
    });

    const superAdmin = await Role.findOne({ where: { name: "super_admin" } });
    const permissions = await Permission.findAll();

    if (!superAdmin) {
      console.error("super_admin role not found.");
      process.exit(1);
    }

    for (const permission of permissions) {
      await ensurePerm(superAdmin.id, menu.id, permission.id);
    }

    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
