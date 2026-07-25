const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(process.cwd(), "uploads", "videos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    const prefix = file.fieldname === "thumbnail" ? "thumb" : "video";
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-msvideo",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only video and image files are allowed."), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
}).fields([
  { name: "video", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);
