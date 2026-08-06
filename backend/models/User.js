const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    mobile: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    id_proof: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    address_proof: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
    },
    clinic_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: null,
    },
    profile_photo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    logo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    experience: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    education: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "specialities", key: "id" },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles", key: "id" },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "plans", key: "id" },
    },
    plan_period: {
      type: DataTypes.ENUM("monthly", "yearly"),
      allowNull: true,
    },
    plan_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plan_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    plan_access: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    // Per-user feature-flag overrides, layered over the base Plan's
    // feature_flags in getEffectiveFeatures(). Used primarily for the
    // Custom plan case, where entitlements are configured per account
    // rather than fixed per plan tier. Only keys that differ from the
    // base plan need to be present (shallow merge, not whole replace).
    feature_overrides: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    trial_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // AI-reply credit tally (1 automatic AI reply = 1 credit). Reset to 0 on
    // plan activation/renewal. Enforced by creditService.getCreditStatus.
    credits_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Highest credit-usage threshold (75/90/100) already alerted on this cycle;
    // prevents duplicate usage alerts. Reset with credits_used.
    credit_alert_level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    stripe_subscription_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Public clinic-directory opt-in flag (issue #29). Defaults true to
    // preserve current-mock-parity for existing clinics on deploy — an
    // opt-out settings toggle is a future ticket, not built here. Never
    // exposed in any public API response (internal filter only).
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["username"],
      },
    ],
  }
);

module.exports = User;
