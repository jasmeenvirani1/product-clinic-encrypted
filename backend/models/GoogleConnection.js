const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One row per tenant PER SERVICE — the clinic's connected Google account +
 * granted OAuth tokens, scoped by the `service` column (e.g. "calendar").
 * Rows are discriminated by `(tenant_id, service)`, not a slot number like
 * WhatsAppSession/InstagramSession — a tenant can independently connect
 * multiple Google services (Calendar, and later Gmail/Drive) on the same or
 * different Google accounts, each getting its own row.
 *
 * `access_token`/`refresh_token` are obtained via a genuine server-to-server
 * OAuth2 authorization-code exchange with Google (NOT a tenant-pasted-in
 * manual credential like InstagramSession.access_token), so they MUST be
 * encrypted at rest — see backend/utils/tokenCrypto.js and
 * .claude/rules/oauth-token-storage.md. This is a deliberate, explicitly
 * flagged deviation from InstagramSession's plaintext-storage precedent.
 *
 * `provider` is fixed to "google" today — it exists only so a future
 * non-Google OAuth provider isn't a schema change. `granted_scopes` is
 * forward-compat for future services (Gmail/Drive) but not consumed by any
 * logic yet; only the Calendar scope is requested/wired today.
 *
 * Disconnect nulls the credential fields and sets status — it never
 * destroy()s the row, mirroring InstagramSession's disconnect convention.
 */
const GoogleConnection = sequelize.define(
  "GoogleConnection",
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
    provider: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "google",
    },
    // Discriminator for per-service connection rows — only "calendar" exists
    // today; future services (Gmail/Drive) append a new enum value here.
    service: {
      type: DataTypes.ENUM("calendar"),
      allowNull: false,
      defaultValue: "calendar",
    },
    status: {
      type: DataTypes.ENUM("disconnected", "connected", "token_expired", "revoked"),
      defaultValue: "disconnected",
    },
    // Display only — resolved via the ID token / userinfo claims on connect.
    google_account_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    // Encrypted at rest (AES-256-GCM ciphertext, base... hex — see tokenCrypto.js).
    access_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // Encrypted at rest.
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    granted_scopes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    last_error: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "google_connections",
    timestamps: true,
    underscored: true,
    indexes: [
      // One Google connection per tenant PER SERVICE — allows a second,
      // independent row for the same tenant once a second service exists,
      // while still preventing duplicate rows for the same (tenant, service).
      { unique: true, fields: ["tenant_id", "service"] },
    ],
  }
);

module.exports = GoogleConnection;
