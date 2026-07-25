const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FAQ = sequelize.define(
  "FAQ",
  {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id:  { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    question:   { type: DataTypes.TEXT, allowNull: false },
    answer:     { type: DataTypes.TEXT, allowNull: false },
    is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "faqs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = FAQ;
