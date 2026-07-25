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
      where: { slug: "sa-hero-content" },
      defaults: {
        name: "Hero Section",
        slug: "sa-hero-content",
        icon: "Sparkles",
        sort_order: 13,
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

    console.log("Hero Section menu + permissions seeded.");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
