const jwt = require("jsonwebtoken");
const { User, Role, Plan } = require("../models");

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password_hash"] },
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
            "campaign_count",
            "features",
            "is_active",
            "is_deleted",
          ],
        },
      ],
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: "Invalid or inactive account." });
    }

    // super_admin bypasses plan validation
    const roleName = user.Role?.name;
    if (roleName !== "super_admin") {
      if (user.plan_id) {
        if (!user.Plan || user.Plan.is_deleted || !user.Plan.is_active) {
          return res.status(403).json({
            success: false,
            message: "Assigned plan is invalid or inactive. Please contact administrator.",
          });
        }
        if (user.plan_expires_at) {
          const isExpired = new Date(user.plan_expires_at) < new Date();
          if (isExpired) {
            req.planExpired = true;
            req.planExpiredMessage = "Your plan has expired. Please renew to continue access.";
          }
        }
      } else {
        // No paid plan — check 14-day free trial
        const isOnTrial = user.trial_ends_at && new Date(user.trial_ends_at) >= new Date();
        if (!isOnTrial) {
          req.planExpired = true;
          req.planExpiredCode = "TRIAL_EXPIRED";
          req.planExpiredMessage = "Your free trial has expired. Please subscribe to continue.";
        }
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token." });
  }
}

function requireActivePlan(req, res, next) {
  if (req.planExpired) {
    return res.status(403).json({
      success: false,
      code: req.planExpiredCode || "PLAN_EXPIRED",
      message: req.planExpiredMessage || "Your plan has expired. Please renew to continue access.",
    });
  }
  next();
}

module.exports = { authenticate, requireActivePlan };
