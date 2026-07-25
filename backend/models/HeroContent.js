const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Singleton row (id = 1) holding the landing-page hero content that the
// super-admin manages: the WhatsApp chat animation (box 1), the automated
// workflow step list (box 2), floating badges, and animation timing.
const HeroContent = sequelize.define(
  "HeroContent",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    // Box 1 — chat animation. Array of:
    //   { sender: 'user' | 'assistant', text, time, delayMs }
    chat_messages: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    // Box 2 — automated workflow list. Array of:
    //   { order, label }
    workflow_steps: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    // Floating badges shown over both boxes. Array of:
    //   { label, icon }  (icon = 'check' | 'rupee' | ...)
    floating_badges: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    // Animation / slider timing (ms).
    slide_interval_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 6000 },
    typing_speed_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1200 },
    step_interval_ms: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1500 },

    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "hero_content",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = HeroContent;
