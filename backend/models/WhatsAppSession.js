const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One row per (tenant, slot) WhatsApp-QR session. A clinic can link more than
 * one WhatsApp number — each number is a "slot" (1, 2, …). The composite
 * accountId used by the Baileys transport is `${tenant_id}:${slot}`; the on-disk
 * credentials live under backend/.wa-sessions/<tenant_id>_<slot>/.
 *
 * These columns only mirror connection state for the UI — the real auth lives on
 * disk. (Replaces the single wa_qr_status/wa_qr_number pair on AISetting, which
 * only supported one number per tenant.)
 */
const WhatsAppSession = sequelize.define(
  "WhatsAppSession",
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
    // 1-based slot number within the tenant (1 = first number, 2 = second, …).
    slot: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Optional friendly label the clinic can give the number ("Sales", "Support").
    label: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM("unlinked", "connecting", "qr_pending", "connected", "disconnected", "logged_out"),
      defaultValue: "unlinked",
    },
    // The connected WhatsApp number (E.164 digits) once linked.
    number: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "whatsapp_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
      // A tenant can have at most one row per slot.
      { unique: true, fields: ["tenant_id", "slot"] },
    ],
  }
);

module.exports = WhatsAppSession;
