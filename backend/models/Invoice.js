const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Invoice = sequelize.define(
  "Invoice",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    lead_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leads", key: "id" },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    generated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "USD",
    },
    status: {
      type: DataTypes.ENUM("draft", "sent", "paid"),
      defaultValue: "sent",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "invoices",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Invoice;
