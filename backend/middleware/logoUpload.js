const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Logos live under uploads/logos and are served statically via /uploads.
const uploadDir = path.join(process.cwd(), "uploads", "logos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

const allowedLogoExtensions = /\.(jpg|jpeg|png|webp)$/i;

const fileFilter = (_req, file, cb) => {
  if (allowedLogoExtensions.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error("Logo must be JPG, JPEG, PNG, or WEBP."));
  }
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("logo");

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const isSizeError = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        success: false,
        message: isSizeError
          ? "Logo too large. Must be 5 MB or less."
          : err.message,
      });
    }
    next();
  });
};
