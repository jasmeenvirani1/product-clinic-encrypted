const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Permission = sequelize.define(
  "Permission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "permissions",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Permission;
