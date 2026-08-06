const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * One row per clinic-created "Lesson" — a curated grouping (title +
 * description) of the tenant's own already-synced Instagram Reels
 * (backend/models/InstagramReel.js), attached via the LessonReel join table
 * (issue #35). Lessons are created directly by the clinic on their own
 * public profile page — not auto-generated from reels, and independent of
 * the reel sync job (backend/services/instagramReelsSync.js is untouched).
 *
 * `tenant_id` mirrors InstagramReel.tenant_id's shape (FK -> users.id).
 * Every mutating route MUST verify the authenticated user's resolved tenant
 * id against this column before allowing update/delete/attach/detach — see
 * lessonController.js's loadOwnedLesson() two-step 404-then-403 check.
 */
const Lesson = sequelize.define(
  "Lesson",
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
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "lessons",
    timestamps: true,
    underscored: true,
    indexes: [
      // Fast "list my lessons" query.
      { fields: ["tenant_id"] },
    ],
  }
);

module.exports = Lesson;
