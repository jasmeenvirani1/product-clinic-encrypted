const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AISetting = sequelize.define(
  "AISetting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "users", key: "id" },
    },
    // AI Behaviour
    ai_tone: {
      type: DataTypes.ENUM("professional", "warm", "premium", "friendly", "formal"),
      defaultValue: "professional",
    },
    prompt_instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "Qualify leads by budget, desired procedure, urgency, and confidence in booking before handing off.",
    },
    escalate_low_confidence: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    auto_handover_high_intent: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Intent Keywords
    high_intent_keywords: {
      type: DataTypes.JSONB,
      defaultValue: [
        "book", "appointment", "schedule", "price", "cost", "how much",
        "available", "when can", "ready", "interested", "buy", "purchase",
        "payment", "deposit", "confirm", "proceed", "sign up",
      ],
    },
    medium_intent_keywords: {
      type: DataTypes.JSONB,
      defaultValue: [
        "info", "information", "details", "tell me", "explain", "options",
        "compare", "recommend", "suggest", "what is", "how does", "plan",
        "package", "treatment", "procedure",
      ],
    },
    low_intent_keywords: {
      type: DataTypes.JSONB,
      defaultValue: [
        "hello", "hi", "hey", "just looking", "maybe", "not sure",
        "later", "thinking", "browsing",
      ],
    },
    // Intent Behaviour Controls
    ai_responds_to_intents: {
      type: DataTypes.JSONB,
      defaultValue: ["low", "medium"],
    },
    email_notify_intents: {
      type: DataTypes.JSONB,
      defaultValue: ["high"],
    },
    notification_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    // OpenAI Integration
    openai_api_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    openai_model: {
      type: DataTypes.STRING(50),
      defaultValue: "gpt-4o-mini",
    },
    // OpenAI-compatible base URL. Empty/null → default OpenAI API
    // (api.openai.com). Set for OpenAI-compatible providers (e.g. MiniMax
    // via https://ollama.com/v1) so the OpenAI SDK targets that endpoint.
    openai_base_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    // Channel toggles — control whether incoming chats from each channel
    // are accepted into the inbox even when credentials are present.
    whatsapp_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    instagram_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // NOTE: The Meta WhatsApp Cloud API / Instagram Graph API credential
    // columns were removed as part of the connection-flow change and replaced
    // by the WhatsApp-QR (Baileys) flow below.
    //
    // WhatsApp-QR channel (standalone module — links the clinic's real WhatsApp
    // via QR scan instead of the Meta Cloud API). Credentials live on disk in
    // backend/.wa-sessions; these columns just mirror connection state for the UI.
    wa_qr_status: {
      type: DataTypes.ENUM("unlinked", "connecting", "qr_pending", "connected", "disconnected", "logged_out"),
      defaultValue: "unlinked",
    },
    wa_qr_number: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
    },
    // Follow-up messages (AI-generated, sent automatically when patient goes silent)
    followup_1_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    followup_1_days: { type: DataTypes.INTEGER, defaultValue: 1 },
    followup_2_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    followup_2_days: { type: DataTypes.INTEGER, defaultValue: 3 },
  },
  {
    tableName: "ai_settings",
    timestamps: true,
    underscored: true,
  }
);

module.exports = AISetting;
