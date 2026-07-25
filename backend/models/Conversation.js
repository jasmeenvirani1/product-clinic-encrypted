const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Conversation = sequelize.define(
  "Conversation",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Nullable: the WhatsApp-QR "Message Yourself" self-chat creates a
    // lead-less conversation (it must not create a CRM lead).
    lead_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "leads", key: "id" },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
    },
    channel: {
      type: DataTypes.ENUM("WhatsApp", "Instagram", "Web Chat"),
      allowNull: false,
      defaultValue: "Web Chat",
    },
    status: {
      type: DataTypes.ENUM("open", "pending", "resolved"),
      defaultValue: "open",
    },
    intent: {
      type: DataTypes.ENUM("high", "medium", "low", "unknown"),
      defaultValue: "unknown",
    },
    ai_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    unread_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // High-intent lead-detail collection state machine.
    // Shape:
    //   { phase: "idle"|"collecting"|"completed"|"escalated",
    //     collected: { name?, phone?, email? },
    //     attempts: number,
    //     triggered_at?: ISO string,
    //     escalated_at?: ISO string }
    lead_capture_state: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Follow-up tracking
    last_patient_message_at: { type: DataTypes.DATE, allowNull: true },
    followup_1_sent_at: { type: DataTypes.DATE, allowNull: true },
    followup_2_sent_at: { type: DataTypes.DATE, allowNull: true },
    // "Message me later" deferred-callback state (deferredReplyService).
    snooze_until: { type: DataTypes.DATE, allowNull: true },
    snooze_note: { type: DataTypes.TEXT, allowNull: true },
    // The exact WhatsApp JID the last inbound arrived on. Deferred callbacks
    // are sent OUTSIDE the live inbound context, so they need the LID-safe JID
    // to deliver — rebuilding "<phone>@s.whatsapp.net" silently fails for LID
    // contacts.
    channel_thread_id: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    // Which WhatsApp-QR slot (linked number) this conversation belongs to, so an
    // outbound reply goes back out the SAME number the patient messaged. Null /
    // 1 = the clinic's first/only number (back-compat).
    wa_slot: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1 },
    // Rolling conversation memory: older turns folded into a running summary
    // so collected facts survive after they leave the recent-message window
    // (chatSummaryService).
    chat_summary: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    custom_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: "conversations",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Conversation;
