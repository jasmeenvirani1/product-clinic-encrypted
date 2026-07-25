const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PaymentHistory = sequelize.define(
  "PaymentHistory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "plans", key: "id" },
    },
    plan_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    billing_period: {
      type: DataTypes.ENUM("monthly", "yearly"),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "USD",
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payment_gateway: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transaction_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "paid", "failed", "refunded"),
      allowNull: false,
      defaultValue: "paid",
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    next_billing_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
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
    tableName: "payment_histories",
    timestamps: true,
    underscored: true,
  }
);

module.exports = PaymentHistory;
