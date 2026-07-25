const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const log = require("../utils/logger");

const MODULE = "MediaIngest";

const INBOX_ROOT = path.join(__dirname, "..", "uploads", "inbox");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

// Ensure the inbox root exists at startup so WhatsApp media can be stored immediately.
ensureDir(INBOX_ROOT);

const guessExt = (mime, fallback = "bin") => {
  if (!mime) return fallback;
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/amr": "amr",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
  };
  return map[mime.toLowerCase()] || fallback;
};

const kindFromMime = (mime) => {
  if (!mime) return "file";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
};

// Public URL the frontend can hit (relative path served by express.static).
const publicUrlFor = (tenantId, fileName) =>
  `/uploads/inbox/${tenantId}/${fileName}`;

// Persist a downloaded buffer to disk and return a stored-attachment record.
const persistBuffer = ({ tenantId, buffer, mimeType, fileName, kind, size }) => {
  const dir = path.join(INBOX_ROOT, String(tenantId));
  ensureDir(dir);
  const ext = path.extname(fileName || "") || `.${guessExt(mimeType)}`;
  const safeBase = (path.basename(fileName || "media", ext) || "media")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 60);
  const unique = crypto.randomBytes(6).toString("hex");
  const finalName = `${Date.now()}_${safeBase}_${unique}${ext}`;
  const fullPath = path.join(dir, finalName);
  fs.writeFileSync(fullPath, buffer);
  return {
    kind: kind || kindFromMime(mimeType),
    url: publicUrlFor(tenantId, finalName),
    mime_type: mimeType || "application/octet-stream",
    file_name: fileName || finalName,
    size: size || buffer.length,
  };
};

// Download a media file from a directly-fetchable URL and persist it.
// Generic helper the new connection flow can reuse for inbound attachments.
// `authToken` is optional — only sent when the URL is token-bound.
const ingestFromUrl = async ({ tenantId, fileUrl, fileName, kindHint, authToken }) => {
  if (!fileUrl) return null;
  try {
    const resp = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      maxContentLength: 25 * 1024 * 1024,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
    const mimeType = resp.headers?.["content-type"] || null;
    const kind = ["image", "video", "audio", "file"].includes((kindHint || "").toLowerCase())
      ? kindHint.toLowerCase()
      : kindFromMime(mimeType);
    return persistBuffer({
      tenantId,
      buffer: Buffer.from(resp.data),
      mimeType,
      fileName: fileName || `${kind}`,
      kind,
    });
  } catch (err) {
    log.error(MODULE, "ingestFromUrl", { error: err.message });
    return null;
  }
};

// ⚠️ Meta WhatsApp media ingest removed (Graph API dependency).
// Previously did: GET graph.facebook.com/{media-id} -> token-bound url ->
// download bytes. The new connection flow should hand a fetchable URL to
// `ingestFromUrl` instead. Stub returns null so any stray caller degrades
// gracefully (attachment simply won't be stored).
const ingestWhatsAppMedia = async () => {
  log.warn(MODULE, "ingestWhatsAppMedia", { message: "Meta media ingest removed — awaiting new connection flow." });
  return null;
};

// Kept as a thin adapter over the generic downloader for callers that still
// pass a Meta-style { attachment } shape. New code should call ingestFromUrl.
const ingestInstagramAttachment = async ({ tenantId, attachment, accessToken }) =>
  ingestFromUrl({
    tenantId,
    fileUrl: attachment?.payload?.url,
    fileName: attachment?.payload?.name,
    kindHint: attachment?.type,
    authToken: accessToken,
  });

module.exports = {
  ingestFromUrl,
  ingestWhatsAppMedia,
  ingestInstagramAttachment,
  kindFromMime,
};
