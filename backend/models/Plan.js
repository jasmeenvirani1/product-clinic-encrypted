const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Plan = sequelize.define(
  "Plan",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    plan_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
          },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    monthly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    yearly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    period: {
      type: DataTypes.ENUM("monthly", "yearly"),
      allowNull: false,
      defaultValue: "monthly",
    },
    campaign_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    // Monthly AI-reply credit cap. null = unlimited (e.g. Enterprise); a number
    // = cap. Consumed via User.credits_used. Enforced by creditService.
    credit_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
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
    tableName: "plans",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Plan;

