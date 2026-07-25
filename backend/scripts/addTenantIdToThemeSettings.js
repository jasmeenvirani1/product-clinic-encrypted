require("dotenv").config();
const { sequelize } = require("../models");

// Adds tenant_id to theme_settings and makes each tenant own its own theme row.
// The pre-existing singleton row (no tenant_id) becomes the global/platform row
// (tenant_id = NULL), which public pages serve and tenants inherit from.
async function run() {
  try {
    await sequelize.authenticate();

    // 1. Add the column if missing.
    await sequelize.query(`
      ALTER TABLE theme_settings
      ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT NULL;
    `);

    // 2. Enforce one row per tenant (and a single global NULL row).
    //    A partial unique index lets multiple rows exist only if the app ever
    //    created dupes; NULLs are treated as distinct by Postgres, so we also
    //    guard the global row explicitly below.
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS theme_settings_tenant_id_uq
      ON theme_settings (tenant_id);
    `);

    // 3. Collapse any accidental duplicate global (NULL) rows into one, keeping
    //    the lowest id (the original singleton).
    await sequelize.query(`
      DELETE FROM theme_settings a
      USING theme_settings b
      WHERE a.tenant_id IS NULL
        AND b.tenant_id IS NULL
        AND a.id > b.id;
    `);

    console.log("✓ theme_settings is now tenant-scoped (global row = tenant_id NULL).");
  } catch (err) {
    console.error("Error:", err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
