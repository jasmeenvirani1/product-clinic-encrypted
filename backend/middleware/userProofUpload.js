const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(process.cwd(), "uploads", "proofs");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "");
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const allowedDocumentExtensions = /\.(jpg|jpeg|png|webp|gif|bmp|svg|pdf)$/i;
const allowedProfilePhotoExtensions = /\.(jpg|jpeg|png|webp)$/i;

const fileFilter = (_req, file, cb) => {
  if (file.fieldname === "profile_photo") {
    if (allowedProfilePhotoExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Profile photo must be JPG, JPEG, PNG, or WEBP."));
    }
    return;
  }

  if (allowedDocumentExtensions.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only JPG, JPEG, PNG, WEBP, GIF, BMP, SVG, and PDF files are allowed."));
  }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).fields([
  { name: "id_proof", maxCount: 10 },
  { name: "address_proof", maxCount: 10 },
  { name: "profile_photo", maxCount: 1 },
]);

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      const isSizeError = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        success: false,
        message: isSizeError
          ? "File too large. Each upload must be 10 MB or less."
          : err.message,
      });
    }
    next();
  });
};
