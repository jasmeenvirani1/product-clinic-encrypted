const { Op } = require("sequelize");
const { User, Role, Plan, PaymentHistory } = require("../models");
const log = require("../utils/logger");

const MODULE = "SuperAdminBillingController";

exports.getPayments = async (req, res) => {
  try {
    const where = { is_deleted: false };

    if (req.query.status) {
      where.status = String(req.query.status).toLowerCase().trim();
    }
    if (req.query.tenant_id) {
      where.tenant_id = Number(req.query.tenant_id);
    }
    if (req.query.user_id) {
      where.user_id = Number(req.query.user_id);
    }

    const payments = await PaymentHistory.findAll({
      where,
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "full_name", "email", "tenant_id"],
          include: [{ model: Role, attributes: ["id", "name"] }],
        },
        {
          model: Plan,
          as: "Plan",
          attributes: ["id", "plan_name", "period", "monthly_price", "yearly_price"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    log.info(MODULE, "getPayments", { userId: req.user.id, count: payments.length });

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (err) {
    log.error(MODULE, "getPayments", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getSubscriptions = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { is_deleted: false, plan_id: { [Op.ne]: null } },
      attributes: [
        "id",
        "full_name",
        "email",
        "mobile",
        "tenant_id",
        "plan_id",
        "plan_period",
        "plan_started_at",
        "plan_expires_at",
        "plan_access",
        "is_active",
      ],
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
      order: [["created_at", "DESC"]],
    });

    const userIds = users.map((u) => u.id);

    const allPayments = userIds.length
      ? await PaymentHistory.findAll({
          where: { is_deleted: false, user_id: { [Op.in]: userIds } },
          attributes: [
            "id",
            "user_id",
            "plan_id",
            "plan_name",
            "billing_period",
            "amount",
            "currency",
            "status",
            "paid_at",
            "created_at",
          ],
          order: [["created_at", "DESC"]],
        })
      : [];

    const latestByUser = new Map();
    const totalByUser = new Map();

    for (const p of allPayments) {
      const uid = p.user_id;
      if (!latestByUser.has(uid)) latestByUser.set(uid, p);
      totalByUser.set(uid, (totalByUser.get(uid) || 0) + Number(p.amount || 0));
    }

    const rows = users.map((u) => {
      const latestPayment = latestByUser.get(u.id) || null;
      return {
        user: {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          mobile: u.mobile,
          role: u.Role ? u.Role.name : null,
          tenant_id: u.tenant_id,
          is_active: u.is_active,
        },
        subscription: {
          plan_id: u.plan_id,
          plan_name: u.Plan ? u.Plan.plan_name : null,
          plan_period: u.plan_period,
          plan_started_at: u.plan_started_at,
          plan_expires_at: u.plan_expires_at,
          plan_access: u.plan_access || {},
          plan: u.Plan || null,
        },
        payments: {
          latest: latestPayment,
          total_amount_paid: Number((totalByUser.get(u.id) || 0).toFixed(2)),
        },
      };
    });

    log.info(MODULE, "getSubscriptions", { userId: req.user.id, count: rows.length });

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    log.error(MODULE, "getSubscriptions", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
