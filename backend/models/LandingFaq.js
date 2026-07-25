const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Global (non-tenant) FAQ list shown on the public landing page. Managed by
// super-admin. Mirrors the tenant FAQ model but drops tenant_id and adds a
// sort_order so the landing page can render them in a controlled order.
const LandingFaq = sequelize.define(
  "LandingFaq",
  {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    question:   { type: DataTypes.TEXT, allowNull: false },
    answer:     { type: DataTypes.TEXT, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "landing_faqs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = LandingFaq;
