const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LeadSummary = sequelize.define(
  "LeadSummary",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    lead_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leads", key: "id" },
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    stage: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    intent: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: "lead_summaries",
    timestamps: true,
    underscored: true,
    updatedAt: false,
  }
);

module.exports = LeadSummary;
