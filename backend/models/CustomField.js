const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CustomField = sequelize.define(
  "CustomField",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    table_name: { type: DataTypes.STRING(100), allowNull: false },
    field_key:  { type: DataTypes.STRING(100), allowNull: false },
    label:      { type: DataTypes.STRING(150), allowNull: false },
    field_type: {
      type: DataTypes.ENUM("text", "number", "date", "select", "boolean"),
      allowNull: false,
      defaultValue: "text",
    },
    options:     { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    is_required: { type: DataTypes.BOOLEAN, defaultValue: false },
    sort_order:  { type: DataTypes.INTEGER, defaultValue: 0 },
    is_active:   { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "custom_fields",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["table_name", "field_key"] }],
  }
);

module.exports = CustomField;
