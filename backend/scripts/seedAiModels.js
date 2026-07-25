require("dotenv").config();
const { sequelize, Menu, Permission, Role, RoleMenuPermission, AiModel } = require("../models");

async function ensurePerm(roleId, menuId, permId) {
  await RoleMenuPermission.findOrCreate({
    where: { role_id: roleId, menu_id: menuId, permission_id: permId },
    defaults: { role_id: roleId, menu_id: menuId, permission_id: permId },
  });
}

// Initial catalogue — mirrors the previously hard-coded AI_MODEL_OPTIONS so the
// dropdown keeps working immediately. Super-admin can edit/add/remove afterwards.
const INITIAL_MODELS = [
  { name: "GPT-4o Mini — fast & affordable", model: "gpt-4o-mini",   provider: "OpenAI",            base_url: null,                      sort_order: 0 },
  { name: "GPT-4o — most capable",           model: "gpt-4o",        provider: "OpenAI",            base_url: null,                      sort_order: 1 },
  { name: "GPT-4 Turbo",                     model: "gpt-4-turbo",   provider: "OpenAI",            base_url: null,                      sort_order: 2 },
  { name: "GPT-3.5 Turbo — cheapest",        model: "gpt-3.5-turbo", provider: "OpenAI",            base_url: null,                      sort_order: 3 },
  { name: "MiniMax M3 (OpenAI Compatible)",  model: "minimax-m3",    provider: "OpenAI Compatible", base_url: "https://ollama.com/v1",   sort_order: 4 },
];

(async () => {
  try {
    await sequelize.authenticate();
    // Ensure the ai_models table exists before inserting (in case the app
    // hasn't run sync yet in this environment).
    await AiModel.sync();

    // 1. Menu + super-admin permissions
    const [menu] = await Menu.findOrCreate({
      where: { slug: "sa-ai-models" },
      defaults: {
        name: "AI Models",
        slug: "sa-ai-models",
        icon: "Bot",
        sort_order: 15,
        is_active: true,
      },
    });

    const superAdmin = await Role.findOne({ where: { name: "super_admin" } });
    if (!superAdmin) {
      console.error("super_admin role not found.");
      process.exit(1);
    }
    const permissions = await Permission.findAll();
    for (const permission of permissions) {
      await ensurePerm(superAdmin.id, menu.id, permission.id);
    }

    // 2. Initial models (only if none exist yet — don't clobber edits)
    const count = await AiModel.count({ where: { is_deleted: false } });
    if (count === 0) {
      for (const m of INITIAL_MODELS) {
        await AiModel.findOrCreate({ where: { model: m.model }, defaults: m });
      }
      console.log(`Seeded ${INITIAL_MODELS.length} initial AI models.`);
    } else {
      console.log(`Skipped model seed — ${count} model(s) already present.`);
    }

    console.log("AI Models menu + permissions seeded.");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
