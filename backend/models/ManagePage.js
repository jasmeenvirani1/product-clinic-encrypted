const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ManagePage = sequelize.define(
  "ManagePage",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    title_tr: { type: DataTypes.STRING(150), allowNull: true },
    slug: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    content_tr: { type: DataTypes.TEXT, allowNull: true },
    footer_label: { type: DataTypes.STRING(100), allowNull: true },
    footer_label_tr: { type: DataTypes.STRING(100), allowNull: true },
    show_in_footer: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "manage_pages",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = ManagePage;
