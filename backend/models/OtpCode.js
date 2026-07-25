const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OtpCode = sequelize.define(
  "OtpCode",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    otp_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("registration", "login", "password_reset"),
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "otp_codes",
    timestamps: true,
    underscored: true,
  }
);

module.exports = OtpCode;
