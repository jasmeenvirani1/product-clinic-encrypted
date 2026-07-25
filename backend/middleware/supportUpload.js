const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(process.cwd(), "uploads", "support");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    cb(null, `attachment-${uniqueSuffix}${ext}`);
  },
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("attachment");

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const isSizeError = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        success: false,
        message: isSizeError
          ? "Attachment too large. Maximum allowed size is 10 MB."
          : err.message,
      });
    }
    next();
  });
};
