const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Targeting: specific user (optional)
    recipient_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    // Targeting: all users of this role (optional, e.g. 'super_admin', 'tenant_admin', 'staff_user')
    recipient_role: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    // Scope: which tenant this notification belongs to (null = platform-wide for super_admin)
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    // Extra data for deep-linking (e.g. lead_id, conversation_id)
    meta: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Notification;
