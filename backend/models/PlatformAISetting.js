const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Singleton table — always row id=1
const PlatformAISetting = sequelize.define(
  "PlatformAISetting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    default_openai_model: {
      type: DataTypes.STRING(50),
      defaultValue: "gpt-4o-mini",
    },
    // OpenAI-compatible base URL for platform-level AI. Empty/null → default
    // OpenAI API. Set for providers like MiniMax (https://ollama.com/v1).
    default_openai_base_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    // Platform-level OpenAI key used for pre-auth / registration-time AI
    // (e.g. logo → theme-colour suggestion), when the new tenant has no
    // per-tenant AISetting.openai_api_key yet. Super-admin controlled.
    platform_openai_api_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    default_prompt_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue:
        "Qualify leads by budget, desired procedure, urgency, and confidence in booking before handing off.",
    },
    // Separate, independent prompt reserved for the "self chat" answer flow.
    // Stored only for now — not yet wired into any AI call path.
    self_chat_prompt: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    use_cases: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: "Array of { title, example_question, correct_answer } to guide AI responses.",
    },
    default_ai_tone: {
      type: DataTypes.ENUM("professional", "warm", "premium", "friendly", "formal"),
      defaultValue: "professional",
    },
    allow_tenant_model_change: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "platform_ai_settings",
    timestamps: true,
    underscored: true,
  }
);

module.exports = PlatformAISetting;
