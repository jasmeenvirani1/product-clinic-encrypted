/**
 * One-time migration: Sets app-guide sort_order to 9999 so it always
 * appears last in the tenant admin sidebar regardless of other menus added.
 *
 * Usage:  node scripts/updateGuideMenuOrder.js
 */
require("dotenv").config();
const { sequelize, Menu } = require("../models");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");

    const [count] = await sequelize.query(
      `UPDATE "Menus" SET sort_order = 9999 WHERE slug = 'app-guide'`
    );

    console.log(`✅ app-guide sort_order updated to 9999 (rows affected: ${count})`);
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
})();
