const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const SupportTicket = sequelize.define(
  "SupportTicket",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("open", "in_progress", "resolved", "closed"),
      defaultValue: "open",
    },
    attachment: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "support_tickets",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SupportTicket;
