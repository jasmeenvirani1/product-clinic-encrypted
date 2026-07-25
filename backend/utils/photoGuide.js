const fs = require("fs");
const path = require("path");
const { guessMimeType } = require("./faqAttachment");

// ─────────────────────────────────────────────────────────────────────────
// PHOTO-GUIDE IMAGE — marker-driven, sent ONCE per conversation.
//
// The AI system prompt (STEP 5 — REQUEST PHOTOS) emits this marker on its own
// line ONLY on the FIRST photo request. The backend strips the marker from the
// visible reply and, when present, attaches the fixed photo-guide image exactly
// once. Because the model emits the marker a single time, the guide is never
// re-sent on later photo-related messages — unlike the old FAQ-match path which
// re-attached it on every matching message.
// ─────────────────────────────────────────────────────────────────────────
const PHOTO_GUIDE_MARKER = "[[PHOTO_GUIDE]]";

// Fixed asset on disk. Default lives under backend/uploads/system/ so it is
// served by express.static ("/uploads/...") — reachable both for the CRM chat
// preview and for link-based transports (Instagram). Override with an absolute
// path via PHOTO_GUIDE_IMAGE_PATH if the file is stored elsewhere.
const PHOTO_GUIDE_PATH =
  process.env.PHOTO_GUIDE_IMAGE_PATH ||
  path.join(process.cwd(), "uploads", "system", "sapphire.jpg");

// Public base URL for link-based media delivery (mirrors faqAttachment.js).
const PUBLIC_BASE = String(
  process.env.BACKEND_PUBLIC_URL || process.env.SERVER_URL || process.env.FRONTEND_URL || ""
).replace(/\/$/, "");

const photoGuideFileName = () => path.basename(PHOTO_GUIDE_PATH);
const photoGuideMime = () => guessMimeType(PHOTO_GUIDE_PATH);

// True only when the configured asset actually exists on disk — callers skip
// sending (and skip the CRM attachment) when the file is missing, so a missing
// asset degrades to a text-only reply instead of throwing.
const photoGuideExists = () => {
  try {
    return fs.statSync(PHOTO_GUIDE_PATH).isFile();
  } catch {
    return false;
  }
};

const readPhotoGuideBuffer = () => fs.readFileSync(PHOTO_GUIDE_PATH);

// Relative URL served by express.static — same shape as inbound media so the
// CRM chat UI renders the guide on the AI reply.
const relativePhotoGuideUrl = () =>
  `/uploads/system/${encodeURIComponent(photoGuideFileName())}`;

// Publicly reachable URL for link-based transports (Instagram). Null when no
// public base URL is configured.
const publicPhotoGuideUrl = () =>
  PUBLIC_BASE
    ? `${PUBLIC_BASE}/uploads/system/${encodeURIComponent(photoGuideFileName())}`
    : null;

// Strip the photo-guide marker out of an AI reply. Returns the cleaned text and
// whether the marker was present (→ the guide image should be attached once).
// Runs on EVERY reply path so the marker can never leak to the patient, even if
// the model emits it outside the intended step.
const extractPhotoGuideMarker = (text) => {
  if (!text || typeof text !== "string" || !text.includes(PHOTO_GUIDE_MARKER)) {
    return { text: text || "", sendGuide: false };
  }
  const cleaned = text
    .split(PHOTO_GUIDE_MARKER)
    .join("")
    .replace(/[ \t]+$/gm, "") // trailing spaces the marker left on a line
    .replace(/\n{3,}/g, "\n\n") // collapse blank-line runs it left behind
    .trim();
  return { text: cleaned, sendGuide: true };
};

// Build a Message.attachments[] record so the CRM chat renders the guide image
// on the AI reply (mirrors buildFaqMessageAttachment in faqAttachment.js).
const buildPhotoGuideMessageAttachment = () => {
  let size;
  try {
    size = fs.statSync(PHOTO_GUIDE_PATH).size;
  } catch {
    size = undefined;
  }
  return {
    kind: "image",
    url: relativePhotoGuideUrl(),
    mime_type: photoGuideMime(),
    file_name: photoGuideFileName(),
    size,
  };
};

module.exports = {
  PHOTO_GUIDE_MARKER,
  PHOTO_GUIDE_PATH,
  extractPhotoGuideMarker,
  photoGuideExists,
  photoGuideFileName,
  photoGuideMime,
  readPhotoGuideBuffer,
  relativePhotoGuideUrl,
  publicPhotoGuideUrl,
  buildPhotoGuideMessageAttachment,
};
