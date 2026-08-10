/**
 * appointmentAvailabilityService.js — orchestration layer sitting above
 * googleOAuthClient.js (thin Google API wrapper) and
 * googleOAuthBootstrap.getValidAccessToken (the sole decrypt/refresh call
 * site). Owns the slot-math (computeOpenSlots, pure), the
 * check_availability tool's orchestration (getAvailability), and the
 * book_appointment tool's orchestration (bookSlot — conflict re-check +
 * dual persistence).
 *
 * Neither googleOAuthClient.js (scoped to being a thin Google API wrapper
 * per its own file-header contract) nor conversationController.js (should
 * not contain slot-math) is the right home for this logic — modeled on how
 * leadCapture.js/leadAutomation.js already sit above raw models as a
 * services-layer convention in this codebase.
 */

const { ClinicSchedule, GoogleConnection, Appointment } = require("../models");
const googleOAuthClient = require("./googleOAuthClient");
const { getValidAccessToken } = require("./googleOAuthBootstrap");
const log = require("../utils/logger");

const MODULE = "AppointmentAvailabilityService";

const WEEKDAY_FIELDS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Load (or create, mirroring AISetting's getOrCreate-on-read convention)
 *  the tenant's ClinicSchedule row. */
async function getOrCreateClinicSchedule(tenantId) {
  let schedule = await ClinicSchedule.findOne({ where: { tenant_id: tenantId } });
  if (!schedule) {
    schedule = await ClinicSchedule.create({ tenant_id: tenantId });
    log.info(MODULE, "getOrCreateClinicSchedule", { message: "Created default clinic schedule", tenantId });
  }
  return schedule;
}

/** Parse an "HH:mm" string into { hours, minutes }. */
function parseHHmm(value) {
  const [h, m] = String(value || "00:00").split(":").map((n) => parseInt(n, 10));
  return { hours: Number.isFinite(h) ? h : 0, minutes: Number.isFinite(m) ? m : 0 };
}

/** Pure function (no I/O): walks each day in [rangeStart, rangeEnd], checks
 *  that weekday's *_open flag + *_start/*_end, generates candidate slots at
 *  slot_duration_minutes increments, subtracts buffer_minutes around each
 *  busyIntervals entry, discards any candidate slot that overlaps a
 *  (buffered) busy interval or falls in the past. Returns
 *  [{ start: ISOString, end: ISOString }, ...]. */
function computeOpenSlots({ clinicSchedule, busyIntervals, rangeStart, rangeEnd }) {
  const slots = [];
  const slotMs = (clinicSchedule.slot_duration_minutes || 30) * 60 * 1000;
  const bufferMs = (clinicSchedule.buffer_minutes || 0) * 60 * 1000;
  const now = new Date();

  // Buffered busy windows — expand each busy interval by bufferMs on both
  // sides so a candidate slot can't butt directly up against another booking.
  const bufferedBusy = (busyIntervals || []).map((b) => ({
    start: new Date(b.start).getTime() - bufferMs,
    end: new Date(b.end).getTime() + bufferMs,
  }));

  const overlapsBusy = (start, end) =>
    bufferedBusy.some((b) => start.getTime() < b.end && end.getTime() > b.start);

  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  // Normalize to whole days, inclusive of rangeEnd's calendar day.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor.getTime() <= lastDay.getTime()) {
    const dayName = WEEKDAY_FIELDS[cursor.getDay()];
    const isOpen = clinicSchedule[`${dayName}_open`];
    if (isOpen) {
      const { hours: startH, minutes: startM } = parseHHmm(clinicSchedule[`${dayName}_start`]);
      const { hours: endH, minutes: endM } = parseHHmm(clinicSchedule[`${dayName}_end`]);

      const dayOpen = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), startH, startM);
      const dayClose = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), endH, endM);

      let slotStart = new Date(dayOpen);
      while (slotStart.getTime() + slotMs <= dayClose.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + slotMs);
        if (slotStart.getTime() >= now.getTime() && !overlapsBusy(slotStart, slotEnd)) {
          slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
        }
        slotStart = new Date(slotStart.getTime() + slotMs);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

/** Orchestration function conversationController.js's check_availability
 *  tool handler calls. Never throws to the caller — the tool-call loop
 *  needs an always-a-value result to feed back to the model.
 *  - { connected: false } when no usable access token (disconnected/
 *    disabled/no row) or booking_enabled === false on the ClinicSchedule row.
 *  - { connected: true, slots: [...] } on success (may be empty — a
 *    fully-booked range is a valid, non-error result).
 *  - { connected: true, slots: [], error: true } only on an actual Google
 *    API failure after the token was confirmed present. */
async function getAvailability({ tenantId, rangeStart, rangeEnd }) {
  const clinicSchedule = await getOrCreateClinicSchedule(tenantId);
  if (!clinicSchedule.booking_enabled) {
    return { connected: false };
  }

  const connection = await GoogleConnection.findOne({ where: { tenant_id: tenantId, service: "calendar" } });
  const accessToken = await getValidAccessToken(connection);
  if (!accessToken) {
    return { connected: false };
  }

  try {
    const timeMin = new Date(rangeStart).toISOString();
    // Freebusy's timeMax is exclusive-day-boundary friendly — extend to the
    // end of rangeEnd's calendar day so that day's slots are covered too.
    const endOfRangeEnd = new Date(rangeEnd);
    endOfRangeEnd.setHours(23, 59, 59, 999);
    const timeMax = endOfRangeEnd.toISOString();

    const busyIntervals = await googleOAuthClient.getFreeBusy(accessToken, { timeMin, timeMax });
    const slots = computeOpenSlots({ clinicSchedule, busyIntervals, rangeStart: timeMin, rangeEnd: timeMax });
    return { connected: true, slots };
  } catch (err) {
    log.error(MODULE, "getAvailability", { tenantId, error: err.message });
    return { connected: true, slots: [], error: true };
  }
}

/** Orchestration function conversationController.js's book_appointment tool
 *  handler calls. Implements the mandatory pre-creation conflict re-check:
 *  1. Re-resolve GoogleConnection + getValidAccessToken — if now unusable,
 *     return { booked: false, reason: "not_connected" } (covers the race
 *     where Calendar was disconnected between the availability check and
 *     the confirm).
 *  2. Re-run getFreeBusy for just the [start, end] window being booked and
 *     confirm no busy interval overlaps it. If it now overlaps, return
 *     { booked: false, reason: "slot_taken" }.
 *  3. Call googleOAuthClient.createEvent(...).
 *  4. Appointment.create({...}).
 *  5. Return { booked: true, appointment: {...}, event: {...} }.
 *  Google create happens BEFORE the local Appointment insert deliberately —
 *  see file header / architecture doc for rationale. */
async function bookSlot({ tenantId, leadId, conversationId, start, end, title, description }) {
  const connection = await GoogleConnection.findOne({ where: { tenant_id: tenantId, service: "calendar" } });
  const accessToken = await getValidAccessToken(connection);
  if (!accessToken) {
    return { booked: false, reason: "not_connected" };
  }

  try {
    const busyIntervals = await googleOAuthClient.getFreeBusy(accessToken, {
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(end).toISOString(),
    });
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const overlaps = (busyIntervals || []).some(
      (b) => startMs < new Date(b.end).getTime() && endMs > new Date(b.start).getTime()
    );
    if (overlaps) {
      return { booked: false, reason: "slot_taken" };
    }

    const event = await googleOAuthClient.createEvent(accessToken, {
      title: title || "Clinic appointment",
      description,
      start,
      end,
    });

    const appointment = await Appointment.create({
      tenant_id: tenantId,
      lead_id: leadId,
      conversation_id: conversationId || null,
      google_event_id: event.id,
      start_time: start,
      end_time: end,
      status: "scheduled",
      notes: description || null,
      created_via: "ai_chat",
    });

    return {
      booked: true,
      appointment: {
        id: appointment.id,
        start: appointment.start_time,
        end: appointment.end_time,
        status: appointment.status,
      },
      event: { id: event.id, htmlLink: event.htmlLink },
    };
  } catch (err) {
    log.error(MODULE, "bookSlot", { tenantId, leadId, error: err.message });
    return { booked: false, reason: "error" };
  }
}

module.exports = {
  computeOpenSlots,
  getAvailability,
  bookSlot,
};
