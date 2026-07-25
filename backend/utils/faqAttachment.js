const fs = require("fs");
const path = require("path");

// Where FAQ uploads are written (mirrors backend/middleware/faqUpload.js).
const FAQ_UPLOAD_DIR = path.join(process.cwd(), "uploads", "faq");

// Public base URL the messaging providers (Instagram / WhatsApp Cloud) can
// reach to fetch a hosted file by link. Falls back to FRONTEND_URL only as a
// last resort — set BACKEND_PUBLIC_URL to the externally reachable backend
// origin for link-based media delivery to work.
const PUBLIC_BASE = String(
  process.env.BACKEND_PUBLIC_URL || process.env.SERVER_URL || process.env.FRONTEND_URL || ""
).replace(/\/$/, "");

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|bmp)$/i;
const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|avi|mkv|ogg)$/i;

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".ogg": "video/ogg",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const isImageAttachment = (filename) => IMAGE_EXT_RE.test(filename || "");
const isVideoAttachment = (filename) => VIDEO_EXT_RE.test(filename || "");

const guessMimeType = (filename) =>
  MIME_BY_EXT[path.extname(filename || "").toLowerCase()] || "application/octet-stream";

// Absolute path of a stored FAQ attachment on disk (for transports that send
// raw bytes, e.g. the QR/Baileys session).
const localFaqAttachmentPath = (filename) => path.join(FAQ_UPLOAD_DIR, path.basename(filename || ""));

// Publicly reachable URL of a stored FAQ attachment (for link-based transports).
// Returns null when no public base URL is configured.
const publicFaqAttachmentUrl = (filename) =>
  PUBLIC_BASE && filename
    ? `${PUBLIC_BASE}/uploads/faq/${encodeURIComponent(path.basename(filename))}`
    : null;

// Relative URL served by express.static — resolved by the frontend against
// NEXT_PUBLIC_BACKEND_ORIGIN (same shape as inbound media attachments).
const relativeFaqAttachmentUrl = (filename) =>
  filename ? `/uploads/faq/${encodeURIComponent(path.basename(filename))}` : null;

// Build a Message.attachments[] record so the CRM chat UI renders the FAQ
// attachment (image/file) on the AI reply, the same way inbound media renders.
const buildFaqMessageAttachment = (filename) => {
  if (!filename) return null;
  let size;
  try {
    size = fs.statSync(localFaqAttachmentPath(filename)).size;
  } catch {
    size = undefined;
  }
  return {
    kind: isImageAttachment(filename)
      ? "image"
      : isVideoAttachment(filename)
      ? "video"
      : "file",
    url: relativeFaqAttachmentUrl(filename),
    mime_type: guessMimeType(filename),
    file_name: path.basename(filename),
    size,
  };
};

module.exports = {
  FAQ_UPLOAD_DIR,
  isImageAttachment,
  isVideoAttachment,
  guessMimeType,
  localFaqAttachmentPath,
  publicFaqAttachmentUrl,
  relativeFaqAttachmentUrl,
  buildFaqMessageAttachment,
};
