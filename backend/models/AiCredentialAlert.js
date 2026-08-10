const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Dedup/cooldown state for the "OpenAI credential failed" super_admin alert
// (issue #42). One row per tenant+credential_type — this is STATE (upserted
// on each fire), not an event log. A fallback-key failure and a tenant-key
// failure for the same tenant dedup independently, since AISetting is a
// single row per tenant and can't hold a composite cooldown key cleanly.
const AiCredentialAlert = sequelize.define(
  "AiCredentialAlert",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    credential_type: {
      type: DataTypes.ENUM("tenant_key", "super_admin_fallback_key"),
      allowNull: false,
    },
    last_alerted_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "ai_credential_alerts",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["tenant_id", "credential_type"],
      },
    ],
  }
);

module.exports = AiCredentialAlert;
