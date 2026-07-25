/**
 * One-time migration: nullify and drop the clinic_name column from the leads table.
 * Run once with: node backend/scripts/removeLeadClinicName.js
 */
const sequelize = require("../config/database");

async function run() {
  const qi = sequelize.getQueryInterface();

  console.log("Step 1: Nullifying clinic_name in all leads...");
  await sequelize.query(`UPDATE leads SET clinic_name = NULL WHERE clinic_name IS NOT NULL`);

  console.log("Step 2: Dropping clinic_name column from leads table...");
  await qi.removeColumn("leads", "clinic_name");

  console.log("Done. clinic_name has been removed from all leads.");
  await sequelize.close();
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
