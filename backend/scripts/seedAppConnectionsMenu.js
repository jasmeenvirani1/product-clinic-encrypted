/**
 * One-time script: Inserts the clinic "App Connections" menu (slug
 * app-connections, icon Plug) and grants:
 *   - tenant_admin: view + edit (sidebar visibility + Save buttons)
 *   - super_admin:  all permissions (RBAC completeness, matches
 *     existing per-feature seed scripts; does not drive the
 *     super-admin sidebar, which is a static code array)
 *
 * Also retires the old "App Integrations" menu (slug app-integrations)
 * by setting is_active = false — the row is preserved, not deleted,
 * per repo convention. Its functionality (WhatsApp/Instagram enable
 * toggle) is now a strict subset of the new Connections page.
 *
 * Idempotent — safe to re-run (findOrCreate + findOrCreate, no
 * duplicate rows on second run).
 *
 * Usage:  node scripts/seedAppConnectionsMenu.js
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

    // ── 1. app-connections menu (clinic) ──────────────────────────────
    const [menu, menuCreated] = await Menu.findOrCreate({
      where: { slug: "app-connections" },
      defaults: {
        name: "App Connections",
        slug: "app-connections",
        icon: "Plug",
        sort_order: 27,
        is_active: true,
      },
    });
    console.log(`\nMenu "app-connections" (id: ${menu.id}) — ${menuCreated ? "CREATED" : "already exists"}`);

    const superAdmin  = await Role.findOne({ where: { name: "super_admin" } });
    const tenantAdmin = await Role.findOne({ where: { name: "tenant_admin" } });

    if (!superAdmin) {
      console.error("ERROR: super_admin role not found.");
      process.exit(1);
    }
    if (!tenantAdmin) {
      console.error("ERROR: tenant_admin role not found.");
      process.exit(1);
    }

    const allPerms = await Permission.findAll();
    const permMap = {};
    for (const p of allPerms) permMap[p.slug] = p;

    // tenant_admin — view (sidebar visibility) + edit (Save buttons)
    const wanted = ["view", "edit"];
    for (const slug of wanted) {
      if (!permMap[slug]) {
        console.error(`ERROR: expected permission "${slug}" not found.`);
        process.exit(1);
      }
      await ensurePerm(tenantAdmin.id, menu.id, permMap[slug].id, `tenant_admin → ${slug}`);
    }

    // super_admin — all permissions (completeness only, matches
    // seedLandingFaqMenu.js / seedVideoMenu.js precedent)
    for (const perm of allPerms) {
      await ensurePerm(superAdmin.id, menu.id, perm.id, `super_admin → ${perm.slug}`);
    }

    // ── 2. Retire app-integrations (deactivate, do NOT delete) ────────
    const oldMenu = await Menu.findOne({ where: { slug: "app-integrations" } });
    if (oldMenu) {
      if (oldMenu.is_active) {
        oldMenu.is_active = false;
        await oldMenu.save();
        console.log(`\nMenu "app-integrations" (id: ${oldMenu.id}) — DEACTIVATED (is_active=false)`);
      } else {
        console.log(`\nMenu "app-integrations" (id: ${oldMenu.id}) — already inactive`);
      }
    } else {
      console.log("\nMenu \"app-integrations\" not found — nothing to deactivate.");
    }

    console.log("\n✅ App Connections menu + permissions ready; App Integrations retired.");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
