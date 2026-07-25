const { HeroContent } = require("../models");
const log = require("../utils/logger");

const MODULE = "HeroContentController";

// Default hero content — migrated from the previously hard-coded landing page
// copy so nothing changes visually on first load.
const DEFAULTS = {
  chat_messages: [
    { sender: "user", text: "Hi! I'd like to book an appointment with Dr. Mehta.", time: "9:02 AM", delayMs: 1200 },
    { sender: "assistant", text: "Sure! Dr. Mehta has an opening tomorrow at 11:30 AM. Shall I book it?", time: "9:02 AM", delayMs: 1800 },
    { sender: "user", text: "Yes please, that works great.", time: "9:03 AM", delayMs: 1200 },
    { sender: "assistant", text: "Booked! You'll get a WhatsApp reminder before your appointment.", time: "9:03 AM", delayMs: 1800 },
  ],
  workflow_steps: [
    { order: 1, label: "Patient books appointment" },
    { order: 2, label: "Reminder sent via WhatsApp" },
    { order: 3, label: "Consultation completed" },
    { order: 4, label: "Billing & prescription shared" },
    { order: 5, label: "Follow-up & review request" },
  ],
  floating_badges: [
    { label: "Appointment confirmed", icon: "check" },
    { label: "Payment received", icon: "rupee" },
  ],
  slide_interval_ms: 6000,
  typing_speed_ms: 1200,
  step_interval_ms: 1500,
  is_active: true,
};

// Always operate on the single row (id = 1), creating it with defaults if missing.
async function getSingleton() {
  const [row] = await HeroContent.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, ...DEFAULTS },
  });
  return row;
}

// GET /api/public/hero-content — consumed by the landing page (no auth).
exports.getPublic = async (_req, res) => {
  try {
    const row = await getSingleton();
    if (!row.is_active) {
      return res.status(200).json({ success: true, data: null });
    }
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    log.error(MODULE, "getPublic", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// GET /api/super-admin/hero-content — admin editor.
exports.getAdmin = async (_req, res) => {
  try {
    const row = await getSingleton();
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    log.error(MODULE, "getAdmin", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

function toInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Normalize + validate an array coming from the client.
function normalizeChat(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .map((m) => ({
      sender: m.sender === "assistant" ? "assistant" : "user",
      text: String(m.text).trim(),
      time: String(m.time || "").trim(),
      delayMs: toInt(m.delayMs, 1500),
    }));
}

function normalizeSteps(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((s) => s && typeof s.label === "string" && s.label.trim())
    .map((s, i) => ({ order: toInt(s.order, i + 1), label: String(s.label).trim() }))
    .sort((a, b) => a.order - b.order);
}

function normalizeBadges(list) {
  if (!Array.isArray(list)) return null;
  return list
    .filter((b) => b && typeof b.label === "string" && b.label.trim())
    .map((b) => ({ label: String(b.label).trim(), icon: String(b.icon || "check").trim() }));
}

// PUT /api/super-admin/hero-content — replace the singleton's content.
exports.update = async (req, res) => {
  try {
    const row = await getSingleton();
    const { chat_messages, workflow_steps, floating_badges, slide_interval_ms, typing_speed_ms, step_interval_ms, is_active } = req.body;

    const patch = {};

    if (chat_messages !== undefined) {
      const chat = normalizeChat(chat_messages);
      if (!chat) return res.status(400).json({ success: false, message: "chat_messages must be an array." });
      patch.chat_messages = chat;
    }
    if (workflow_steps !== undefined) {
      const steps = normalizeSteps(workflow_steps);
      if (!steps) return res.status(400).json({ success: false, message: "workflow_steps must be an array." });
      patch.workflow_steps = steps;
    }
    if (floating_badges !== undefined) {
      const badges = normalizeBadges(floating_badges);
      if (!badges) return res.status(400).json({ success: false, message: "floating_badges must be an array." });
      patch.floating_badges = badges;
    }
    if (slide_interval_ms !== undefined) patch.slide_interval_ms = toInt(slide_interval_ms, row.slide_interval_ms);
    if (typing_speed_ms !== undefined) patch.typing_speed_ms = toInt(typing_speed_ms, row.typing_speed_ms);
    if (step_interval_ms !== undefined) patch.step_interval_ms = toInt(step_interval_ms, row.step_interval_ms);
    if (is_active !== undefined) patch.is_active = is_active === true;

    await row.update(patch);

    log.info(MODULE, "update", { userId: req.user?.id });
    return res.status(200).json({ success: true, message: "Hero content updated.", data: row });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.DEFAULTS = DEFAULTS;
