const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Speciality detail-content images live under uploads/specialities and are
// served statically via /uploads (see index.js).
const uploadDir = path.join(process.cwd(), "uploads", "specialities");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    cb(null, `speciality-${uniqueSuffix}${ext}`);
  },
});

const allowedImageExtensions = /\.(jpg|jpeg|png|webp|gif)$/i;

const fileFilter = (_req, file, cb) => {
  if (allowedImageExtensions.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error("Image must be JPG, JPEG, PNG, WEBP, or GIF."));
  }
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("image");

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const isSizeError = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        success: false,
        message: isSizeError
          ? "Image too large. Must be 5 MB or less."
          : err.message,
      });
    }
    next();
  });
};
