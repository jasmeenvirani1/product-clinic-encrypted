const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User, Role, Plan, OtpCode, RoleMenuPermission, Menu, Permission } = require("../models");
const { generateOtp, hashOtp, verifyOtp } = require("../utils/otp");
const { sendOtpEmail } = require("../utils/mailer");
const log = require("../utils/logger");
const { getEffectiveFeatures } = require("../services/planFeatureService");

const MODULE = "AuthController";
const OTP_EXPIRY = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);

const mapUploadedProofs = (files = []) =>
  files.map((f) => f.filename || path.basename((f.path || "").replace(/\\/g, "/")));
const mapSingleUploadedFile = (files = []) => {
  const file = files[0];
  if (!file) return null;
  return file.filename || path.basename((file.path || "").replace(/\\/g, "/"));
};
const deleteProofFile = (filename) => {
  if (!filename) return;
  const filePath = path.join(process.cwd(), "uploads", "proofs", filename);
  require("fs").unlink(filePath, () => {});
};

const mapUserPlanContext = (user) => {
  const now = new Date();
  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  const isOnTrial = !user.plan_id && trialEndsAt && trialEndsAt >= now;
  const trialDaysLeft = isOnTrial
    ? Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24))
    : null;

  if (!user?.plan_id) {
    const isTrialExpired = trialEndsAt && trialEndsAt < now;
    return {
      plan_id: null,
      period: null,
      started_at: null,
      expires_at: null,
      is_expired: !!isTrialExpired,
      access: {},
      plan: null,
      is_on_trial: !!isOnTrial,
      trial_ends_at: user.trial_ends_at || null,
      trial_days_left: trialDaysLeft,
    };
  }

  const expiresAt = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
  const isExpired = expiresAt ? expiresAt < now : false;

  return {
    plan_id: user.plan_id,
    period: user.plan_period || user.Plan?.period || null,
    started_at: user.plan_started_at || null,
    expires_at: user.plan_expires_at || null,
    is_expired: isExpired,
    access: user.plan_access || {
      features: user.Plan?.features || [],
    },
    plan: user.Plan
      ? {
          id: user.Plan.id,
          name: user.Plan.plan_name,
          monthly_price: user.Plan.monthly_price,
          yearly_price: user.Plan.yearly_price,
          period: user.Plan.period,
        }
      : null,
    is_on_trial: false,
    trial_ends_at: user.trial_ends_at || null,
    trial_days_left: null,
  };
};

// Register: send OTP
exports.sendRegistrationOtp = async (req, res) => {
  try {
    const { full_name, email, mobile, password } = req.body;

    log.info(MODULE, "sendRegistrationOtp", { email });

    if (!full_name || !email || !password) {
      log.warn(MODULE, "sendRegistrationOtp", { message: "Missing required fields" });
      return res.status(400).json({ success: false, message: "full_name, email and password are required." });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase().trim(), is_deleted: false } });
    if (existing) {
      log.warn(MODULE, "sendRegistrationOtp", { email, message: "Email already registered" });
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    await OtpCode.update(
      { is_used: true },
      { where: { email: email.toLowerCase().trim(), type: "registration", is_used: false } }
    );

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await OtpCode.create({
      email: email.toLowerCase().trim(),
      otp_hash: otpHash,
      type: "registration",
      expires_at: new Date(Date.now() + OTP_EXPIRY * 60 * 1000),
    });

    await sendOtpEmail(email, otp, "registration");

    log.info(MODULE, "sendRegistrationOtp", { email, message: "OTP sent" });
    return res.status(200).json({ success: true, message: "OTP sent to your email." });
  } catch (err) {
    log.error(MODULE, "sendRegistrationOtp", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Register: verify OTP & create user
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { full_name, email, mobile, password, otp, role_id } = req.body;
    const idProofFiles = mapUploadedProofs(req.files?.id_proof || []);
    const addressProofFiles = mapUploadedProofs(req.files?.address_proof || []);
    const profilePhoto = mapSingleUploadedFile(req.files?.profile_photo || []);

    log.info(MODULE, "verifyRegistrationOtp", { email, role_id });

    if (!full_name || !email || !password || !otp) {
      log.warn(MODULE, "verifyRegistrationOtp", { message: "Missing required fields" });
      return res.status(400).json({ success: false, message: "full_name, email, password and otp are required." });
    }

    const emailNorm = email.toLowerCase().trim();

    const otpRecord = await OtpCode.findOne({
      where: {
        email: emailNorm,
        type: "registration",
        is_used: false,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    if (!otpRecord) {
      log.warn(MODULE, "verifyRegistrationOtp", { email, message: "OTP expired or invalid" });
      return res.status(400).json({ success: false, message: "OTP expired or invalid." });
    }

    const isValid = await verifyOtp(otp, otpRecord.otp_hash);
    if (!isValid) {
      log.warn(MODULE, "verifyRegistrationOtp", { email, message: "Invalid OTP" });
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    otpRecord.is_used = true;
    await otpRecord.save();

    let assignedRoleId = role_id ? Number(role_id) : null;
    if (!assignedRoleId) {
      const defaultRole = await Role.findOne({ where: { name: "tenant_admin" } });
      if (!defaultRole) {
        return res.status(500).json({ success: false, message: "Default role not configured." });
      }
      assignedRoleId = defaultRole.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const user = await User.create({
      full_name: full_name.trim(),
      email: emailNorm,
      mobile: mobile || null,
      password_hash: passwordHash,
      role_id: assignedRoleId,
      email_verified: true,
      id_proof: idProofFiles,
      address_proof: addressProofFiles,
      profile_photo: profilePhoto,
      trial_ends_at: trialEndsAt,
    });

    const token = jwt.sign({ id: user.id, role_id: user.role_id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    log.info(MODULE, "verifyRegistrationOtp", { userId: user.id, email, message: "Registration successful" });
    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      data: {
        token,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role_id: user.role_id,
          profile_photo: user.profile_photo,
        },
      },
    });
  } catch (err) {
    log.error(MODULE, "verifyRegistrationOtp", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Login with email & password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    log.info(MODULE, "login", { email });

    if (!email || !password) {
      log.warn(MODULE, "login", { message: "Missing email or password" });
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase().trim(), is_deleted: false },
      include: [
        { model: Role, attributes: ["id", "name"] },
        {
          model: Plan,
          attributes: [
            "id",
            "plan_name",
            "period",
            "monthly_price",
            "yearly_price",
            "features",
            "feature_flags",
            "is_active",
            "is_deleted",
          ],
        },
      ],
    });

    if (!user) {
      log.warn(MODULE, "login", { email, message: "Invalid email" });
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    if (!user.is_active) {
      log.warn(MODULE, "login", { userId: user.id, email, message: "Account deactivated" });
      return res.status(403).json({ success: false, message: "Your account has been disabled by the admin. Please contact support." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      log.warn(MODULE, "login", { email, message: "Invalid password" });
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const menuPermissions = await getMenuPermissions(user.role_id);

    const token = jwt.sign(
      { id: user.id, role_id: user.role_id, role: user.Role.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const redirectTo = user.Role.name === "super_admin"
          ? "/super-admin/dashboard"
          : "/app/dashboard";

        log.info(MODULE, "login", { userId: user.id, email, role: user.Role.name, message: "Login successful" });
        return res.status(200).json({
          success: true,
          message: "Login successful.",
          data: {
            token,
            user: {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
              profile_photo: user.profile_photo,
              role: user.Role.name,
            },
            menuPermissions,
            planContext: mapUserPlanContext(user),
            redirectTo,
          },
        });
      } catch (err) {
        log.error(MODULE, "login", { error: err.message });
        return res.status(500).json({ success: false, message: "Internal server error." });
      }
    };

// Forgot password: send OTP
exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    log.info(MODULE, "sendForgotPasswordOtp", { email });

    if (!email) {
      log.warn(MODULE, "sendForgotPasswordOtp", { message: "Missing email" });
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const emailNorm = email.toLowerCase().trim();
    const user = await User.findOne({ where: { email: emailNorm } });

    if (!user) {
      log.info(MODULE, "sendForgotPasswordOtp", { email, message: "Email not found, silent success" });
      return res.status(200).json({ success: true, message: "If the email exists, an OTP has been sent." });
    }

    await OtpCode.update(
      { is_used: true },
      { where: { email: emailNorm, type: "password_reset", is_used: false } }
    );

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await OtpCode.create({
      user_id: user.id,
      email: emailNorm,
      otp_hash: otpHash,
      type: "password_reset",
      expires_at: new Date(Date.now() + OTP_EXPIRY * 60 * 1000),
    });

    await sendOtpEmail(emailNorm, otp, "password_reset");

    log.info(MODULE, "sendForgotPasswordOtp", { email, message: "OTP sent" });
    return res.status(200).json({ success: true, message: "If the email exists, an OTP has been sent." });
  } catch (err) {
    log.error(MODULE, "sendForgotPasswordOtp", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Forgot password: verify OTP
exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    log.info(MODULE, "verifyForgotPasswordOtp", { email });

    if (!email || !otp) {
      log.warn(MODULE, "verifyForgotPasswordOtp", { message: "Missing email or OTP" });
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const emailNorm = email.toLowerCase().trim();

    const otpRecord = await OtpCode.findOne({
      where: {
        email: emailNorm,
        type: "password_reset",
        is_used: false,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    if (!otpRecord) {
      log.warn(MODULE, "verifyForgotPasswordOtp", { email, message: "OTP expired or invalid" });
      return res.status(400).json({ success: false, message: "OTP expired or invalid." });
    }

    const isValid = await verifyOtp(otp, otpRecord.otp_hash);
    if (!isValid) {
      log.warn(MODULE, "verifyForgotPasswordOtp", { email, message: "Invalid OTP" });
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    otpRecord.is_used = true;
    await otpRecord.save();

    const resetToken = jwt.sign({ email: emailNorm, purpose: "password_reset" }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    log.info(MODULE, "verifyForgotPasswordOtp", { email, message: "OTP verified" });
    return res.status(200).json({ success: true, message: "OTP verified.", data: { resetToken } });
  } catch (err) {
    log.error(MODULE, "verifyForgotPasswordOtp", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, new_password } = req.body;

    log.info(MODULE, "resetPassword", { message: "Password reset attempted" });

    if (!resetToken || !new_password) {
      log.warn(MODULE, "resetPassword", { message: "Missing resetToken or new_password" });
      return res.status(400).json({ success: false, message: "Reset token and new_password are required." });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      log.warn(MODULE, "resetPassword", { message: "Invalid or expired reset token" });
      return res.status(400).json({ success: false, message: "Invalid or expired reset token." });
    }

    if (decoded.purpose !== "password_reset") {
      log.warn(MODULE, "resetPassword", { message: "Invalid token purpose" });
      return res.status(400).json({ success: false, message: "Invalid token." });
    }

    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      log.warn(MODULE, "resetPassword", { email: decoded.email, message: "User not found" });
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();

    log.info(MODULE, "resetPassword", { userId: user.id, email: decoded.email, message: "Password reset successful" });
    return res.status(200).json({ success: true, message: "Password reset successful." });
  } catch (err) {
    log.error(MODULE, "resetPassword", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Update current user's own profile
exports.updateProfile = async (req, res) => {
  try {
    log.info(MODULE, "updateProfile", { userId: req.user.id });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const { full_name, mobile, clinic_name, old_password, new_password, remove_profile_photo } = req.body;
    const profilePhoto = mapSingleUploadedFile(req.files?.profile_photo || []);

    if (full_name !== undefined) user.full_name = full_name.trim();
    if (mobile !== undefined) user.mobile = mobile || null;
    if (clinic_name !== undefined) user.clinic_name = clinic_name || null;
    if (String(remove_profile_photo) === "true") {
      deleteProofFile(user.profile_photo);
      user.profile_photo = null;
    }
    if (profilePhoto) {
      if (user.profile_photo && user.profile_photo !== profilePhoto) deleteProofFile(user.profile_photo);
      user.profile_photo = profilePhoto;
    }

    if (new_password) {
      if (!old_password) {
        return res.status(400).json({ success: false, message: "Current password is required to set a new password." });
      }
      const match = await bcrypt.compare(old_password, user.password_hash);
      if (!match) {
        return res.status(400).json({ success: false, message: "Current password is incorrect." });
      }
      user.password_hash = await bcrypt.hash(new_password, 10);
    }

    await user.save();

    log.info(MODULE, "updateProfile", { userId: req.user.id, message: "Profile updated" });
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        mobile: user.mobile,
        clinic_name: user.clinic_name,
        profile_photo: user.profile_photo,
      },
    });
  } catch (err) {
    log.error(MODULE, "updateProfile", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get current user profile
exports.me = async (req, res) => {
  try {
    log.info(MODULE, "me", { userId: req.user.id });

    const menuPermissions = await getMenuPermissions(req.user.role_id);

    const planContext = {
      ...mapUserPlanContext(req.user),
      feature_flags: getEffectiveFeatures(req.user),
    };

    log.info(MODULE, "me", { userId: req.user.id, message: "Profile fetched" });
    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          full_name: req.user.full_name,
          email: req.user.email,
          mobile: req.user.mobile,
          clinic_name: req.user.clinic_name ?? null,
          profile_photo: req.user.profile_photo ?? null,
          role: req.user.Role.name,
        },
        menuPermissions,
        planContext,
      },
    });
  } catch (err) {
    log.error(MODULE, "me", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Helper: get menu permissions for a role
async function getMenuPermissions(roleId) {
  const rows = await RoleMenuPermission.findAll({
    where: { role_id: roleId },
    include: [
      { model: Menu, attributes: ["id", "name", "slug", "icon", "parent_id", "sort_order"] },
      { model: Permission, attributes: ["id", "name", "slug"] },
    ],
  });

  const menuMap = {};
  for (const row of rows) {
    const menuSlug = row.Menu.slug;
    if (!menuMap[menuSlug]) {
      menuMap[menuSlug] = {
        menu: {
          id: row.Menu.id,
          name: row.Menu.name,
          slug: row.Menu.slug,
          icon: row.Menu.icon,
          parent_id: row.Menu.parent_id,
          sort_order: row.Menu.sort_order,
        },
        permissions: [],
      };
    }
    menuMap[menuSlug].permissions.push(row.Permission.slug);
  }

  return Object.values(menuMap);
}
