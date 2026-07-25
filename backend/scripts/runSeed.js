require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { sequelize } = require("../models");
const seed = require("../seeders/seed");

async function fixConstraints() {
  // The DB may have been created with UNIQUE(role_id, menu_id) which prevents
  // storing multiple permissions per menu. Drop it so the correct
  // UNIQUE(role_id, menu_id, permission_id) from the model definition is used.
  await sequelize.query(`
    ALTER TABLE role_menu_permissions
      DROP CONSTRAINT IF EXISTS role_menu_permissions_role_id_menu_id_key;
  `);
  // Also drop any stale 3-column unique index so sync() can recreate it cleanly.
  await sequelize.query(`
    ALTER TABLE role_menu_permissions
      DROP CONSTRAINT IF EXISTS role_menu_permissions_role_id_menu_id_permission_id_key;
  `);
  console.log("Constraints fixed.");
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected.");
    await fixConstraints();
    await sequelize.sync({ alter: true });
    console.log("Database synced.");
    await seed();
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
