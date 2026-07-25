const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// One row per (tenant, table). hidden_fields is a JSON array of field_key strings.
// Storing HIDDEN keys means new custom fields auto-appear for all tenants by default.
const TenantFieldPreference = sequelize.define(
  "TenantFieldPreference",
  {
    id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tenant_id:    { type: DataTypes.INTEGER, allowNull: false },
    table_name:   { type: DataTypes.STRING(100), allowNull: false },
    hidden_fields: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  },
  {
    tableName: "tenant_field_preferences",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["tenant_id", "table_name"] }],
  }
);

module.exports = TenantFieldPreference;
