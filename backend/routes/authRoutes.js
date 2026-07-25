const router = require("express").Router();
const auth = require("../controllers/authController");
const brandSetup = require("../controllers/brandSetupController");
const { authenticate } = require("../middleware/auth");
const userProofUpload = require("../middleware/userProofUpload");
const logoUpload = require("../middleware/logoUpload");

// Registration
router.post("/register/send-otp", auth.sendRegistrationOtp);
router.post("/register/verify-otp", userProofUpload, auth.verifyRegistrationOtp);

// Brand setup — post-OTP step: upload logo + get an AI-suggested theme colour.
// Authenticated because the tenant/user already exists after verify-otp.
router.post("/register/brand-setup", authenticate, logoUpload, brandSetup.uploadLogoAndSuggestTheme);

// Login
router.post("/login", auth.login);

// Forgot Password
router.post("/forgot-password/send-otp", auth.sendForgotPasswordOtp);
router.post("/forgot-password/verify-otp", auth.verifyForgotPasswordOtp);
router.post("/forgot-password/reset", auth.resetPassword);

// Profile (protected)
router.get("/me", authenticate, auth.me);
router.put("/profile", authenticate, userProofUpload, auth.updateProfile);

module.exports = router;
