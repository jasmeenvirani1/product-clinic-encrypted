const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One row per (tenant, slot, ig_media_id) — a synced Instagram Reel's
 * metadata, populated by backend/services/instagramReelsSync.js and read by
 * clinicController.getPublicByUsername for the public profile "Videos"
 * section (issue #33).
 *
 * Sourced from Meta's IG Media `/{ig-business-account-id}/media` edge,
 * filtered client-side (in instagramReelsSync.js / metaGraphApi.getReels) for
 * `media_product_type === "REELS"` — Graph API has no server-side Reels-only
 * filter param. Requires the `instagram_business_basic` scope (renamed from
 * the deprecated `instagram_basic`, retired by Meta 2025-01-27) on the
 * tenant's InstagramSession.access_token.
 *
 * All URL/text fields below are plain Meta-hosted URLs or public post
 * metadata — NOT secrets, so (unlike InstagramSession.access_token, which is
 * also intentionally plaintext per that model's own header/the
 * oauth-token-storage.md carve-out for tenant-pasted credentials) there is
 * no encryption question here at all; this table never stores any
 * credential. `media_url` (the raw playable video file) is stored for
 * potential future backend-only use but MUST NEVER be returned by any public
 * endpoint — Meta does not guarantee its stability and may omit it outright
 * for copyright-flagged content. Only `thumbnail_url`/`permalink` are safe
 * for public exposure (see clinicController.getPublicByUsername's allowlist).
 */
const InstagramReel = sequelize.define(
  "InstagramReel",
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
    // Mirrors InstagramSession's slot column. Only slot 1 is used today
    // (MAX_SLOTS_PER_TENANT = 1 in instagramDmBootstrap.js), kept here for
    // shape parity so a future multi-account addition is non-breaking.
    slot: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Meta's IG Media `id` — the natural external key for idempotent upsert.
    ig_media_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    // Raw Graph value, e.g. "VIDEO" — kept for debugging/future filtering,
    // NEVER exposed via the public endpoint.
    media_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    // Raw Graph value, e.g. "REELS" — same reasoning as media_type above.
    media_product_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // The actual playable video file URL, Meta-hosted. Not guaranteed stable
    // by Meta and may be omitted (e.g. copyright-flagged media) — stored for
    // potential future backend-only use, NEVER returned publicly.
    media_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    thumbnail_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // Stable instagram.com/reel/... link — safe to expose long-term.
    permalink: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    like_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    comments_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // Graph's `timestamp` field, renamed to avoid clashing with Sequelize's
    // own `timestamps: true` createdAt/updatedAt columns.
    posted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    // Set on every successful sync pass, for observability.
    last_synced_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "instagram_reels",
    timestamps: true,
    underscored: true,
    indexes: [
      // Idempotent upsert key.
      { unique: true, fields: ["tenant_id", "slot", "ig_media_id"] },
      // Fast lookup for the public-profile query.
      { fields: ["tenant_id", "slot"] },
    ],
  }
);

module.exports = InstagramReel;
