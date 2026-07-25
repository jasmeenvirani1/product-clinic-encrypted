const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Menu = sequelize.define(
  "Menu",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "menus",
        key: "id",
      },
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "menus",
    timestamps: true,
    underscored: true,
  }
);

Menu.hasMany(Menu, { as: "children", foreignKey: "parent_id" });
Menu.belongsTo(Menu, { as: "parent", foreignKey: "parent_id" });

module.exports = Menu;
