const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Appointment — local record of a booked appointment. Google Calendar is
 * NOT the sole system of record; every confirmed booking is persisted both
 * as a Google Calendar event AND as a row here (see
 * appointmentAvailabilityService.bookSlot, which always creates the Google
 * event BEFORE this row — a failed Google call never leaves an orphaned
 * local row).
 *
 * `lead_id` reuses `Lead` as the patient/contact identity — this codebase
 * has no separate `Patient` model; `Conversation.lead_id` already
 * establishes this precedent for chat.
 *
 * `google_event_id` stays null until the Google Calendar event is actually
 * created, and stays null forever on the fallback/not-connected path (which
 * never creates an Appointment row at all).
 */
const Appointment = sequelize.define(
  "Appointment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    lead_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "leads", key: "id" },
    },
    // Which chat thread produced this booking. Nullable so a future
    // non-chat booking path (e.g. manual staff creation) isn't blocked.
    conversation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "conversations", key: "id" },
    },
    // Null until the Google Calendar event is created; stays null forever
    // on the fallback/not-connected path.
    google_event_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("scheduled", "cancelled", "completed"),
      defaultValue: "scheduled",
    },
    // Free-text captured from the booking conversation (e.g. "consultation
    // for hair transplant").
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // This ticket only ever writes "ai_chat"; "manual" is reserved for a
    // future staff-created-appointment UI, not built this ticket.
    created_via: {
      type: DataTypes.ENUM("ai_chat", "manual"),
      defaultValue: "ai_chat",
    },
  },
  {
    tableName: "appointments",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Appointment;
