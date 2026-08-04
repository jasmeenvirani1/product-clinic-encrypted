const bcrypt = require("bcryptjs");
const { Role, Permission, Menu, RoleMenuPermission, User } = require("../models");

async function seed() {
  console.log("Seeding database...");

  // ─── Permissions ────────────────────────────────────────────────
  const permDefs = [
    { name: "View",     slug: "view"     },
    { name: "View All", slug: "view_all" },
    { name: "Create",   slug: "create"   },
    { name: "Edit",     slug: "edit"     },
    { name: "Delete",   slug: "delete"   },
  ];
  const perms = {};
  for (const p of permDefs) {
    const [perm] = await Permission.findOrCreate({
      where: { slug: p.slug },
      defaults: { name: p.name },
    });
    perms[p.slug] = perm;
  }

  // ─── Roles ──────────────────────────────────────────────────────
  const roleDefs = [
    { name: "super_admin",  description: "Super Administrator with full access" },
    { name: "tenant_admin", description: "Tenant Administrator"                 },
    { name: "staff_user",   description: "Staff User with limited access"       },
  ];
  const roles = {};
  for (const r of roleDefs) {
    const [role] = await Role.findOrCreate({
      where: { name: r.name },
      defaults: { description: r.description },
    });
    roles[r.name] = role;
  }

  // ─── Menus ──────────────────────────────────────────────────────
  const menuDefs = [
    // ── Super-Admin menus ──
    { name: "SA Dashboard",    slug: "sa-dashboard",      icon: "LayoutDashboard", sort_order: 1  },
    { name: "Tenants",         slug: "sa-tenants",        icon: "Building2",       sort_order: 2  },
    { name: "SA Users",        slug: "sa-users",          icon: "Users",           sort_order: 3  },
    { name: "Subscriptions",   slug: "sa-subscriptions",  icon: "Package2",        sort_order: 4  },
    { name: "Payments",        slug: "sa-payments",       icon: "CreditCard",      sort_order: 5  },
    { name: "Plans",           slug: "plans",          icon: "BadgeDollarSign", sort_order: 6  },
    { name: "AI Settings",     slug: "sa-ai-settings",    icon: "Bot",             sort_order: 7  },
    { name: "System Logs",     slug: "sa-logs",           icon: "Gauge",           sort_order: 8  },
    { name: "SA Integrations", slug: "sa-integrations",   icon: "Wrench",          sort_order: 9  },
    { name: "Video Management", slug: "sa-videos",         icon: "Video",           sort_order: 10 },
    { name: "Support",         slug: "sa-support",        icon: "LifeBuoy",        sort_order: 11 },
    { name: "Manage Pages",    slug: "sa-manage-pages",   icon: "FileText",        sort_order: 12 },
    // ── RBAC management menus (used by checkPermission in routes) ──
    { name: "Roles",           slug: "roles",             icon: "ShieldCheck",     sort_order: 13 },
    { name: "Menus",           slug: "menus",             icon: "LayoutList",      sort_order: 14 },
    { name: "Permissions",     slug: "permissions",       icon: "KeyRound",        sort_order: 15 },
    // ── App (tenant) menus ──
    { name: "Dashboard",       slug: "app-dashboard",     icon: "LayoutDashboard", sort_order: 16 },
    { name: "Leads",           slug: "app-leads",         icon: "Users",           sort_order: 17 },
    { name: "Conversations",   slug: "app-conversations", icon: "MessagesSquare",  sort_order: 18 },
    { name: "AI Chat",         slug: "app-ai-chat",       icon: "Sparkles",        sort_order: 19 },
    { name: "Campaigns",       slug: "app-campaigns",     icon: "MessageSquare",   sort_order: 20 },
    { name: "Pricing",         slug: "app-pricing",       icon: "Receipt",         sort_order: 21 },
    { name: "Automation",      slug: "app-automation",    icon: "Workflow",        sort_order: 22 },
    { name: "App Integrations",slug: "app-integrations",  icon: "Wrench",          sort_order: 23, is_active: false },
    { name: "Settings",        slug: "app-settings",      icon: "Settings",        sort_order: 24 },
    { name: "Billing",         slug: "app-billing",       icon: "CreditCard",      sort_order: 25 },
    { name: "Team",            slug: "app-team",          icon: "UserCog",         sort_order: 26 },
    { name: "App Connections", slug: "app-connections",   icon: "Plug",            sort_order: 27 },
    { name: "Guide",           slug: "app-guide",         icon: "PlayCircle",      sort_order: 9999 },
  ];
  const menus = {};
  for (const m of menuDefs) {
    const [menu, created] = await Menu.findOrCreate({
      where: { slug: m.slug },
      defaults: m,
    });
    // Keep is_active in sync on re-runs too — app-integrations is retired
    // (Menu row preserved, not deleted, per repo convention) in favor of
    // the new app-connections menu.
    if (!created && typeof m.is_active === "boolean" && menu.is_active !== m.is_active) {
      menu.is_active = m.is_active;
      await menu.save();
    }
    menus[m.slug] = menu;
  }

  // ─── super_admin: full access to every menu ─────────────────────
  await RoleMenuPermission.destroy({ where: { role_id: roles["super_admin"].id } });
  const saRecords = [];
  for (const menuKey of Object.keys(menus)) {
    for (const permKey of Object.keys(perms)) {
      saRecords.push({
        role_id:       roles["super_admin"].id,
        menu_id:       menus[menuKey].id,
        permission_id: perms[permKey].id,
      });
    }
  }
  await RoleMenuPermission.bulkCreate(saRecords);

  // ─── tenant_admin: full access to app menus ─────────────────────
  await RoleMenuPermission.destroy({ where: { role_id: roles["tenant_admin"].id } });
  const tenantMenuSlugs = [
    "app-dashboard", "app-leads", "app-conversations", "app-ai-chat",
    "app-campaigns", "app-pricing", "app-automation",
    "app-settings", "app-billing", "app-team", "app-connections", "plans", "app-guide",
  ];
  const taRecords = [];
  for (const slug of tenantMenuSlugs) {
    for (const permKey of ["view", "create", "edit", "delete"]) {
      taRecords.push({
        role_id:       roles["tenant_admin"].id,
        menu_id:       menus[slug].id,
        permission_id: perms[permKey].id,
      });
    }
  }
  await RoleMenuPermission.bulkCreate(taRecords);

  // ─── staff_user: view on dashboard + leads + conversations ──────
  await RoleMenuPermission.destroy({ where: { role_id: roles["staff_user"].id } });
  const staffViewMenus = ["app-dashboard", "app-leads", "app-conversations", "app-guide"];
  const staffRecords = [];
  for (const slug of staffViewMenus) {
    staffRecords.push({
      role_id:       roles["staff_user"].id,
      menu_id:       menus[slug].id,
      permission_id: perms["view"].id,
    });
  }
  // Staff can also create leads
  staffRecords.push({
    role_id:       roles["staff_user"].id,
    menu_id:       menus["app-leads"].id,
    permission_id: perms["create"].id,
  });
  await RoleMenuPermission.bulkCreate(staffRecords);

  // ─── Super Admin user ────────────────────────────────────────────
  const saEmail    = process.env.SUPER_ADMIN_EMAIL    || "super@medleads.ai";
  const saPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin@123";
  const [saUser, saCreated] = await User.findOrCreate({
    where: { email: saEmail },
    defaults: {
      full_name:      "Super Admin",
      email:          saEmail,
      password_hash:  await bcrypt.hash(saPassword, 10),
      role_id:        roles["super_admin"].id,
      is_active:      true,
      email_verified: true,
    },
  });
  if (!saCreated) {
    saUser.role_id = roles["super_admin"].id;
    saUser.password_hash = await bcrypt.hash(saPassword, 10);
    saUser.is_active = true;
    saUser.email_verified = true;
    await saUser.save();
  }

  // ─── Demo tenant_admin user ─────────────────────────────────────
  const taEmail    = "owner@novaclinic.ai";
  const taPassword = "Admin@123";
  const [taUser, taCreated] = await User.findOrCreate({
    where: { email: taEmail },
    defaults: {
      full_name:      "Nova Clinic Owner",
      email:          taEmail,
      password_hash:  await bcrypt.hash(taPassword, 10),
      role_id:        roles["tenant_admin"].id,
      is_active:      true,
      email_verified: true,
    },
  });
  if (!taCreated) {
    taUser.role_id = roles["tenant_admin"].id;
    taUser.password_hash = await bcrypt.hash(taPassword, 10);
    taUser.is_active = true;
    taUser.email_verified = true;
    await taUser.save();
  }

  // ─── Demo staff_user ────────────────────────────────────────────
  const staffEmail    = "staff@novaclinic.ai";
  const staffPassword = "Admin@123";
  const [staffUser, staffCreated] = await User.findOrCreate({
    where: { email: staffEmail },
    defaults: {
      full_name:      "Nova Staff",
      email:          staffEmail,
      password_hash:  await bcrypt.hash(staffPassword, 10),
      role_id:        roles["staff_user"].id,
      is_active:      true,
      email_verified: true,
    },
  });
  if (!staffCreated) {
    staffUser.role_id = roles["staff_user"].id;
    staffUser.password_hash = await bcrypt.hash(staffPassword, 10);
    staffUser.is_active = true;
    staffUser.email_verified = true;
    await staffUser.save();
  }

  console.log("\n✅  Seed complete!\n");
  console.log("──── Test Credentials ───────────────────────────────────────────");
  console.log(`  [super_admin]    ${saEmail}    /  ${saPassword}`);
  console.log(`  Access: ALL menus + ALL permissions (bypasses RBAC checks)\n`);
  console.log(`  [tenant_admin]   ${taEmail}  /  ${taPassword}`);
  console.log(`  Access: app-* menus (dashboard, leads, team…) — full CRUD\n`);
  console.log(`  [staff_user]     ${staffEmail}   /  ${staffPassword}`);
  console.log(`  Access: dashboard/leads/conversations (view) + leads (create)`);
  console.log("─────────────────────────────────────────────────────────────────\n");
}

module.exports = seed;




