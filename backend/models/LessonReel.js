const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Join table between Lesson and InstagramReel (many-to-many) — issue #35.
 * References InstagramReel.id (the internal PK), not ig_media_id, for a
 * clean integer FK matching every other association in models/index.js.
 * The join row itself carries no data beyond the two FKs; it is never
 * serialized directly (see clinicController/lessonController's
 * `through: { attributes: [] }` usage).
 *
 * A reel may belong to zero or more lessons; a lesson may have zero or more
 * reels attached. Unique pair prevents double-attaching the same reel to
 * the same lesson (attachReel uses findOrCreate so a repeat attach is a
 * no-op, not a unique-constraint error).
 */
const LessonReel = sequelize.define(
  "LessonReel",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    lesson_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "lessons", key: "id" },
    },
    instagram_reel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "instagram_reels", key: "id" },
    },
  },
  {
    tableName: "lesson_reels",
    timestamps: true,
    underscored: true,
    indexes: [
      // A reel can't be attached twice to the same lesson.
      { unique: true, fields: ["lesson_id", "instagram_reel_id"] },
      { fields: ["lesson_id"] },
      { fields: ["instagram_reel_id"] },
    ],
  }
);

module.exports = LessonReel;
