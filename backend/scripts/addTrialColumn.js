require("dotenv").config();
const { sequelize } = require("../models");

async function run() {
  try {
    await sequelize.authenticate();
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    `);
    console.log("✓ trial_ends_at column added to users table.");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await sequelize.close();
  }
}

run();
