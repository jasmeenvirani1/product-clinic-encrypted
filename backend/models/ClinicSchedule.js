const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * ClinicSchedule — single row per tenant, flat typed columns (mirrors
 * AISetting's convention: scalar settings get flat columns, not a JSONB
 * blob). Configures the clinic's open hours/weekdays/slot length/buffer
 * used by appointmentAvailabilityService to compute bookable slots for the
 * AI chat booking tool loop (see conversationController.js's BOOKING_TOOLS).
 *
 * `booking_enabled` is a tenant-level kill switch for the AI's *own*
 * auto-booking specifically — independent of whether Google Calendar itself
 * is connected (a clinic may keep Calendar connected for staff's own event
 * mirroring while turning off AI auto-booking).
 *
 * getOrCreate-on-first-read is the standard access pattern here, same as
 * AISetting.
 */
const ClinicSchedule = sequelize.define(
  "ClinicSchedule",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "users", key: "id" },
    },
    // Needed so slot-time math is unambiguous once Calendar's freebusy (UTC)
    // is compared against clinic-local open hours.
    timezone: {
      type: DataTypes.STRING(50),
      defaultValue: "UTC",
    },
    monday_open: { type: DataTypes.BOOLEAN, defaultValue: true },
    monday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    monday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    tuesday_open: { type: DataTypes.BOOLEAN, defaultValue: true },
    tuesday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    tuesday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    wednesday_open: { type: DataTypes.BOOLEAN, defaultValue: true },
    wednesday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    wednesday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    thursday_open: { type: DataTypes.BOOLEAN, defaultValue: true },
    thursday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    thursday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    friday_open: { type: DataTypes.BOOLEAN, defaultValue: true },
    friday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    friday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    saturday_open: { type: DataTypes.BOOLEAN, defaultValue: false },
    saturday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    saturday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    sunday_open: { type: DataTypes.BOOLEAN, defaultValue: false },
    sunday_start: { type: DataTypes.STRING(5), defaultValue: "09:00" },
    sunday_end: { type: DataTypes.STRING(5), defaultValue: "17:00" },
    // Length of one bookable appointment, in minutes.
    slot_duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    // Gap enforced between consecutive bookings, in minutes.
    buffer_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // Tenant-level kill switch for AI auto-booking (see file header).
    booking_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "clinic_schedules",
    timestamps: true,
    underscored: true,
  }
);

module.exports = ClinicSchedule;
