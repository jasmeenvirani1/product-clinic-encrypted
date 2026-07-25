/**
 * One-time script: Inserts "Video Management" (super-admin) and
 * "Guide" (tenant/staff) menus with proper role permissions.
 *
 * Guide sidebar visibility requires "view_all" permission.
 *
 * Usage:  node scripts/seedVideoMenu.js
 */
require("dotenv").config();
const { sequelize, Menu, Permission, Role, RoleMenuPermission } = require("../models");

async function ensurePerm(roleId, menuId, permId, label) {
  const [, created] = await RoleMenuPermission.findOrCreate({
    where: { role_id: roleId, menu_id: menuId, permission_id: permId },
    defaults: { role_id: roleId, menu_id: menuId, permission_id: permId },
  });
  console.log(`  ${label}: ${created ? "CREATED" : "exists"}`);
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");

    // Ensure view_all permission exists
    const [viewAllPerm] = await Permission.findOrCreate({
      where: { slug: "view_all" },
      defaults: { name: "View All", slug: "view_all" },
    });
    console.log(`Permission "view_all" (id: ${viewAllPerm.id}) ready.`);

    const allPerms = await Permission.findAll();
    const permMap = {};
    for (const p of allPerms) permMap[p.slug] = p;

    const superAdmin  = await Role.findOne({ where: { name: "super_admin" } });
    const tenantAdmin = await Role.findOne({ where: { name: "tenant_admin" } });
    const staffUser   = await Role.findOne({ where: { name: "staff_user" } });

    if (!superAdmin) { console.error("ERROR: super_admin role not found."); process.exit(1); }

    // ── 1. sa-videos menu (super admin — full CRUD) ──────────────────
    const [saMenu, saCreated] = await Menu.findOrCreate({
      where: { slug: "sa-videos" },
      defaults: { name: "Video Management", slug: "sa-videos", icon: "Video", sort_order: 10, is_active: true },
    });
    console.log(`\nMenu "sa-videos" (id: ${saMenu.id}) — ${saCreated ? "CREATED" : "already exists"}`);

    for (const perm of allPerms) {
      await ensurePerm(superAdmin.id, saMenu.id, perm.id, `super_admin → ${perm.slug}`);
    }

    // ── 2. app-guide menu ────────────────────────────────────────────
    const [guideMenu, guideCreated] = await Menu.findOrCreate({
      where: { slug: "app-guide" },
      defaults: { name: "User's Guide", slug: "app-guide", icon: "PlayCircle", sort_order: 9999, is_active: true },
    });
    console.log(`\nMenu "app-guide" (id: ${guideMenu.id}) — ${guideCreated ? "CREATED" : "already exists"}`);

    // super_admin — all permissions
    for (const perm of allPerms) {
      await ensurePerm(superAdmin.id, guideMenu.id, perm.id, `super_admin → ${perm.slug}`);
    }

    // tenant_admin — view + view_all (view_all makes it visible in sidebar)
    if (tenantAdmin) {
      await ensurePerm(tenantAdmin.id, guideMenu.id, permMap["view"].id, "tenant_admin → view");
      await ensurePerm(tenantAdmin.id, guideMenu.id, permMap["view_all"].id, "tenant_admin → view_all");
    }

    // staff_user — view + view_all
    if (staffUser) {
      await ensurePerm(staffUser.id, guideMenu.id, permMap["view"].id, "staff_user → view");
      await ensurePerm(staffUser.id, guideMenu.id, permMap["view_all"].id, "staff_user → view_all");
    }

    console.log("\n✅ Video Management + Guide menus & permissions ready!");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
