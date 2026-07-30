const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// One row per tenant. tenant_id = null is the platform / global theme that
// public (pre-login) pages use and that tenants inherit from until they override.
const ThemeSetting = sequelize.define(
  "ThemeSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true, // one theme row per tenant (and one global row for null)
    },
    colors: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    // Platform-wide display name (super_admin only). Only meaningful on the
    // tenant_id = null (global) row — tenant rows leave this null and it is
    // never merged into tenant theme responses.
    platform_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "theme_settings",
    // The physical table has no timestamp columns, so keep timestamps off —
    // otherwise sync({ alter:true }) tries to ADD created_at/updated_at as
    // NOT NULL on existing rows and crashes (error 23502). Theme rows don't
    // need created/updated tracking.
    timestamps: false,
  }
);

module.exports = ThemeSetting;
