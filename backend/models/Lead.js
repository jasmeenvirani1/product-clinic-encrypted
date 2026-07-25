const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Lead = sequelize.define(
  "Lead",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    stage: {
      type: DataTypes.ENUM("new", "qualified", "discussion", "won", "lost"),
      defaultValue: "new",
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    last_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    ai_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    summary_updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    custom_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: "leads",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Lead;
