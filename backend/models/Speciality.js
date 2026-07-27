const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Master list of specialities. tenant_id = null is the super-admin master
// row set; non-null rows will be per-tenant overrides (added in a follow-up
// ticket). Unlike ThemeSetting (one row per tenant, unique tenant_id),
// Speciality allows many rows per tenant, so uniqueness is enforced on the
// composite (tenant_id, slug) pair instead of tenant_id alone.
const Speciality = sequelize.define(
  "Speciality",
  {
    id:                { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id:         { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    slug:              { type: DataTypes.STRING, allowNull: false },
    name:              { type: DataTypes.STRING, allowNull: false },
    icon:              { type: DataTypes.STRING, allowNull: true },
    short_description: { type: DataTypes.TEXT, allowNull: true },
    detail_content:    { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    order:             { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active:         { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted:        { type: DataTypes.BOOLEAN, defaultValue: false },
    meta_title:        { type: DataTypes.STRING, allowNull: true },
    meta_description:  { type: DataTypes.TEXT, allowNull: true },
    og_title:          { type: DataTypes.STRING, allowNull: true },
    og_description:    { type: DataTypes.TEXT, allowNull: true },
    og_image:          { type: DataTypes.STRING, allowNull: true },
    canonical_url:     { type: DataTypes.STRING, allowNull: true },
    keywords:          { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "specialities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { unique: true, fields: ["tenant_id", "slug"] },
    ],
  }
);

module.exports = Speciality;
