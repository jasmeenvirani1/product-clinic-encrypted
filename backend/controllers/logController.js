const fs = require("fs");
const path = require("path");
const log = require("../utils/logger");

const MODULE = "LogController";
const logDir = path.join(__dirname, "..", "logs");

// ─── Get logs (with optional filters) ──────────────────────────────
// Query params: date (YYYY-MM-DD), level, module, action, page, limit
exports.getLogs = async (req, res) => {
  try {
    log.info(MODULE, "getLogs", { userId: req.user.id, query: req.query });

    const { date, level, module: mod, action, page = 1, limit = 100 } = req.query;

    if (!fs.existsSync(logDir)) {
      return res.status(200).json({ success: true, data: [], total: 0, page: +page, limit: +limit });
    }

    // If a specific date is requested, read only that file; otherwise read all log files
    const logFiles = date
      ? [path.join(logDir, `${date}.log`)]
      : fs.readdirSync(logDir).filter((f) => f.endsWith(".log")).map((f) => path.join(logDir, f));

    const existingFiles = logFiles.filter((f) => fs.existsSync(f));
    if (existingFiles.length === 0) {
      return res.status(200).json({ success: true, data: [], total: 0, page: +page, limit: +limit });
    }

    let logs = existingFiles.flatMap((logFile) => {
      const content = fs.readFileSync(logFile, "utf-8");
      return content
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    });

    // Apply filters
    if (level) logs = logs.filter((l) => l.level === level.toUpperCase());
    if (mod) logs = logs.filter((l) => l.module === mod);
    if (action) logs = logs.filter((l) => l.action === action);

    // Most recent first
    logs.reverse();

    const total = logs.length;
    const offset = (+page - 1) * +limit;
    const paginated = logs.slice(offset, offset + +limit);

    return res.status(200).json({ success: true, data: paginated, total, page: +page, limit: +limit });
  } catch (err) {
    log.error(MODULE, "getLogs", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ─── Get available log dates ────────────────────────────────────────
exports.getLogDates = async (req, res) => {
  try {
    log.info(MODULE, "getLogDates", { userId: req.user.id });

    if (!fs.existsSync(logDir)) {
      return res.status(200).json({ success: true, data: [] });
    }

    const files = fs.readdirSync(logDir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => f.replace(".log", ""))
      .sort()
      .reverse();

    return res.status(200).json({ success: true, data: files });
  } catch (err) {
    log.error(MODULE, "getLogDates", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
