const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One row per (tenant, slot) Instagram DM session. Mirrors WhatsAppSession's
 * pattern exactly: a clinic can (in theory) link more than one Instagram
 * account — each account is a "slot" (1, 2, …), though today only slot 1 is
 * exposed in the UI. The composite accountId used by the instagram-dm
 * transport is `${tenant_id}:${slot}`; the on-disk session state lives under
 * backend/.ig-sessions/<tenant_id>_<slot>/.
 *
 * These columns only mirror connection state for the UI — the real session
 * (instagram-private-api's serialized device/cookie state) lives on disk.
 * The one-time login password is NEVER persisted anywhere — it is used
 * transiently during the initial connect call and discarded from memory
 * once the session is established.
 */
const InstagramSession = sequelize.define(
  "InstagramSession",
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
    // 1-based slot number within the tenant (1 = first account, 2 = second, …).
    slot: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Optional friendly label the clinic can give the account ("Main IG").
    label: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM(
        "unlinked",
        "connecting",
        "awaiting_2fa",
        "awaiting_challenge",
        "connected",
        "disconnected",
        "logged_out",
        "banned"
      ),
      defaultValue: "unlinked",
    },
    // The connected Instagram handle once linked.
    ig_username: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: null,
    },
    // Last transport error surfaced to the UI (e.g. checkpoint/challenge text).
    last_error: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "instagram_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
      // A tenant can have at most one row per slot.
      { unique: true, fields: ["tenant_id", "slot"] },
    ],
  }
);

module.exports = InstagramSession;
