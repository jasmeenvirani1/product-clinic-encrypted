const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

function getLogFile() {
  const date = new Date().toISOString().split("T")[0];
  return path.join(logDir, `${date}.log`);
}

function formatLog(level, module, action, data) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, module, action, ...data };
  return JSON.stringify(entry);
}

function writeLog(level, module, action, data = {}) {
  const line = formatLog(level, module, action, data);
  fs.appendFileSync(getLogFile(), line + "\n");
}

module.exports = {
  info: (module, action, data) => writeLog("INFO", module, action, data),
  warn: (module, action, data) => writeLog("WARN", module, action, data),
  error: (module, action, data) => writeLog("ERROR", module, action, data),
};
