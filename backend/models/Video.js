const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Video = sequelize.define(
  "Video",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    thumbnail: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    menu_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "menus", key: "id" },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // When true, this video is shown in the landing page's feature section.
    // Only one video should have this set at a time (enforced in the controller).
    show_on_landing: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "videos",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Video;
