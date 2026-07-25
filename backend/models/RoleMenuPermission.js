const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RoleMenuPermission = sequelize.define(
  "RoleMenuPermission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles", key: "id" },
    },
    menu_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "menus", key: "id" },
    },
    permission_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "permissions", key: "id" },
    },
  },
  {
    tableName: "role_menu_permissions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["role_id", "menu_id", "permission_id"],
      },
    ],
  }
);

module.exports = RoleMenuPermission;
