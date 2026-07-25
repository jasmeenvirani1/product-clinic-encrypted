const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Campaign = sequelize.define(
  "Campaign",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    // Offer details
    offer_type: {
      type: DataTypes.ENUM("discount", "package", "free_consultation", "custom"),
      defaultValue: "custom",
    },
    offer_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Message to send
    message_template: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Channel
    channel: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    // WhatsApp template (optional — required for outbound campaigns outside 24h window)
    whatsapp_template_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    whatsapp_template_language: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "en",
    },
    // Audience targeting
    audience: {
      type: DataTypes.ENUM("all", "new_leads", "old_leads", "inactive_leads", "won_leads", "lost_leads"),
      defaultValue: "all",
    },
    // How many days to consider "inactive" or "old"
    audience_days: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: "For old/inactive: leads older than X days",
    },
    budget: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("draft", "active", "paused", "completed"),
      defaultValue: "draft",
    },
    // Stats
    total_recipients: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sent_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    custom_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: "campaigns",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Campaign;
