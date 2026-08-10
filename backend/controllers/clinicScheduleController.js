const { ClinicSchedule } = require("../models");
const log = require("../utils/logger");

const MODULE = "ClinicScheduleController";

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Flattens the DB's flat per-day columns (monday_open/monday_start/
 *  monday_end, etc.) into the wire shape's nested per-day objects. Frontend
 *  never sees flat column names — this mapping lives ONLY here. */
function toWireShape(setting) {
  const data = setting.toJSON();
  const wire = {
    id: data.id,
    tenant_id: data.tenant_id,
    timezone: data.timezone,
    slot_duration_minutes: data.slot_duration_minutes,
    buffer_minutes: data.buffer_minutes,
    booking_enabled: data.booking_enabled,
  };
  for (const day of WEEKDAYS) {
    wire[day] = {
      open: data[`${day}_open`],
      start: data[`${day}_start`],
      end: data[`${day}_end`],
    };
  }
  return wire;
}

/** Validates a partial per-day payload. Returns an error message string, or
 *  null if valid. */
function validateDayPayload(day, payload) {
  if (payload.open !== undefined && typeof payload.open !== "boolean") {
    return `${day}.open must be a boolean.`;
  }
  if (payload.start !== undefined && !HHMM_RE.test(payload.start)) {
    return `${day}.start must be in HH:mm format.`;
  }
  if (payload.end !== undefined && !HHMM_RE.test(payload.end)) {
    return `${day}.end must be in HH:mm format.`;
  }
  return null;
}

// ─── Get clinic schedule for current tenant ─────────────────────────
exports.get = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || req.user.id;

    let setting = await ClinicSchedule.findOne({ where: { tenant_id: tenantId } });
    if (!setting) {
      setting = await ClinicSchedule.create({ tenant_id: tenantId });
      log.info(MODULE, "get", { message: "Created default clinic schedule", tenantId });
    }

    log.info(MODULE, "get", { userId: req.user.id, tenantId });
    return res.status(200).json({ success: true, data: toWireShape(setting) });
  } catch (err) {
    log.error(MODULE, "get", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Update clinic schedule (tenant_admin / super_admin only) ───────
exports.update = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    if (role !== "tenant_admin" && role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const tenantId = req.user.tenant_id || req.user.id;

    let setting = await ClinicSchedule.findOne({ where: { tenant_id: tenantId } });
    if (!setting) {
      setting = await ClinicSchedule.create({ tenant_id: tenantId });
    }

    const {
      timezone,
      slot_duration_minutes,
      buffer_minutes,
      booking_enabled,
      ...dayPayloads
    } = req.body || {};

    if (slot_duration_minutes !== undefined) {
      const n = parseInt(slot_duration_minutes, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ success: false, message: "slot_duration_minutes must be a positive integer." });
      }
    }
    if (buffer_minutes !== undefined) {
      const n = parseInt(buffer_minutes, 10);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ success: false, message: "buffer_minutes must be a positive integer." });
      }
    }

    for (const day of WEEKDAYS) {
      const payload = dayPayloads[day];
      if (payload === undefined) continue;
      const err = validateDayPayload(day, payload);
      if (err) {
        return res.status(400).json({ success: false, message: err });
      }
    }

    if (timezone !== undefined) setting.timezone = timezone;
    if (slot_duration_minutes !== undefined) setting.slot_duration_minutes = parseInt(slot_duration_minutes, 10);
    if (buffer_minutes !== undefined) setting.buffer_minutes = parseInt(buffer_minutes, 10);
    if (booking_enabled !== undefined) setting.booking_enabled = !!booking_enabled;

    for (const day of WEEKDAYS) {
      const payload = dayPayloads[day];
      if (payload === undefined) continue;
      if (payload.open !== undefined) setting[`${day}_open`] = payload.open;
      if (payload.start !== undefined) setting[`${day}_start`] = payload.start;
      if (payload.end !== undefined) setting[`${day}_end`] = payload.end;
    }

    await setting.save();

    log.info(MODULE, "update", { userId: req.user.id, tenantId });
    return res.status(200).json({ success: true, message: "Clinic schedule updated.", data: toWireShape(setting) });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
