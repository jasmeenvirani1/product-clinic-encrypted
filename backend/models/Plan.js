const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Plan = sequelize.define(
  "Plan",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    plan_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
          },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    monthly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    yearly_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    period: {
      type: DataTypes.ENUM("monthly", "yearly"),
      allowNull: false,
      defaultValue: "monthly",
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    // Plan-wise feature gating (whatsapp_multi_connection,
    // dedicated_clinic_page, chapter_instagram_integration,
    // instagram_realtime_fetch, chapter_creation, video_like,
    // automatic_website_generation). See backend/constants/planFeatures.js
    // for the canonical key list/defaults and
    // backend/services/planFeatureService.js for resolution. Resolved live
    // via getEffectiveFeatures(user), not snapshotted onto User.
    feature_flags: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    // Monthly AI-reply credit cap. null = unlimited (e.g. Enterprise); a number
    // = cap. Consumed via User.credits_used. Enforced by creditService.
    credit_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    // Max number of WhatsApp numbers (slots) a tenant on this plan may
    // connect. null = unlimited (e.g. Enterprise); a number = cap. Same
    // null-means-unlimited convention as credit_limit above — do not use a
    // different sentinel (e.g. -1). Counted against WhatsAppSession rows via
    // whatsappNumberLimitService, overridable per-account via
    // User.feature_overrides.max_whatsapp_numbers.
    max_whatsapp_numbers: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "plans",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Plan;

