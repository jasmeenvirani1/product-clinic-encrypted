const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Global (non-tenant) SEO metadata for static landing pages. Managed by
// super-admin only — purely global, no tenant_id concept whatsoever.
// One row per page_key (e.g. 'landing'), extensible to other static pages later.
const SeoSetting = sequelize.define(
  "SeoSetting",
  {
    id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    page_key:         { type: DataTypes.STRING, allowNull: false, unique: true },
    meta_title:       { type: DataTypes.STRING, allowNull: true },
    meta_description: { type: DataTypes.TEXT, allowNull: true },
    og_title:         { type: DataTypes.STRING, allowNull: true },
    og_description:   { type: DataTypes.TEXT, allowNull: true },
    og_image:         { type: DataTypes.STRING, allowNull: true },
    canonical_url:    { type: DataTypes.STRING, allowNull: true },
    keywords:         { type: DataTypes.TEXT, allowNull: true },
    is_active:        { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "seo_settings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SeoSetting;
