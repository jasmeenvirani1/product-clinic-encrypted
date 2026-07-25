const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "conversations", key: "id" },
    },
    sender_type: {
      type: DataTypes.ENUM("patient", "ai", "human"),
      allowNull: false,
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    receiver_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    receiver_type: {
      type: DataTypes.ENUM("patient", "user"),
      allowNull: true,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: "Array of { url, mime_type, file_name, size, kind } for media messages.",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: "Extra data: photos, intent analysis, budget signals etc.",
    },
  },
  {
    tableName: "messages",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Message;
