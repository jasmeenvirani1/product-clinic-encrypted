const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Super-admin-managed catalogue of selectable AI models. Populates the model
// dropdown in both the super-admin platform defaults and the tenant AI settings.
// Selecting a model resolves its provider + base_url so no URL is typed by hand.
//   - model:    the id string sent to the OpenAI-compatible SDK (e.g. "gpt-4o-mini")
//   - provider: display label (e.g. "OpenAI", "OpenAI Compatible")
//   - base_url: endpoint for the SDK; null/empty means default api.openai.com
const AiModel = sequelize.define(
  "AiModel",
  {
    id:         { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name:       { type: DataTypes.STRING(120), allowNull: false }, // human label, e.g. "GPT-4o Mini — fast"
    model:      { type: DataTypes.STRING(100), allowNull: false }, // model id string
    provider:   { type: DataTypes.STRING(80), allowNull: false, defaultValue: "OpenAI" },
    base_url:   { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: "ai_models",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = AiModel;
