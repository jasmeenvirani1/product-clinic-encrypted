const { Op, fn, col, literal } = require("sequelize");
const { User, Role, Plan, PaymentHistory, SupportTicket, Lead } = require("../models");
const log = require("../utils/logger");

const MODULE = "SuperAdminDashboardController";

exports.getDashboard = async (req, res) => {
  try {
    // ── Resolve role IDs ──────────────────────────────────────────
    const tenantAdminRole = await Role.findOne({ where: { name: "tenant_admin" } });
    const superAdminRole  = await Role.findOne({ where: { name: "super_admin" } });

    const now       = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── 1. Total Tenants (tenant_admin, not deleted) ──────────────
    const totalTenants = await User.count({
      where: { role_id: tenantAdminRole?.id ?? 0, is_deleted: false },
    });

    const tenantsLastMonth = await User.count({
      where: {
        role_id: tenantAdminRole?.id ?? 0,
        is_deleted: false,
        created_at: { [Op.lt]: startOfMonth },
      },
    });

    const tenantGrowth = tenantsLastMonth > 0
      ? (((totalTenants - tenantsLastMonth) / tenantsLastMonth) * 100).toFixed(1)
      : "0";

    // ── 2. MRR (paid payments this month) ─────────────────────────
    const mrrResult = await PaymentHistory.sum("amount", {
      where: {
        status: "paid",
        is_deleted: false,
        paid_at: { [Op.gte]: startOfMonth },
      },
    });
    const mrr = Number(mrrResult || 0);

    const lastMonthRevenue = await PaymentHistory.sum("amount", {
      where: {
        status: "paid",
        is_deleted: false,
        paid_at: { [Op.between]: [startOfLastMonth, endOfLastMonth] },
      },
    });
    const lastMrr = Number(lastMonthRevenue || 0);
    const mrrChange = lastMrr > 0
      ? (((mrr - lastMrr) / lastMrr) * 100).toFixed(1)
      : "0";

    // ── 3. Active Users (all non-deleted, non-super_admin) ────────
    const activeUsers = await User.count({
      where: {
        is_deleted: false,
        is_active: true,
        role_id: { [Op.ne]: superAdminRole?.id ?? 0 },
      },
    });

    const newUsersLast30d = await User.count({
      where: {
        is_deleted: false,
        is_active: true,
        role_id: { [Op.ne]: superAdminRole?.id ?? 0 },
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
    });

    // ── 4. Total Booked (won leads across tenants) ────────────────
    const totalBooked = await Lead.count({
      where: {
        stage: "won",
        is_deleted: false,
      },
    });

    // ── 5. Recent Tenants ─────────────────────────────────────────
    const recentTenants = await User.findAll({
      where: { role_id: tenantAdminRole?.id ?? 0, is_deleted: false },
      attributes: ["id", "full_name", "email", "is_active", "created_at"],
      include: [
        { model: Plan, attributes: ["id", "plan_name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    const tenants = recentTenants.map((u) => ({
      id: u.id,
      name: u.full_name,
      email: u.email,
      plan: u.Plan?.plan_name ?? "—",
      status: u.is_active ? "active" : "inactive",
      createdAt: u.created_at,
    }));

    // ── 6. Recent Payments ────────────────────────────────────────
    const recentPayments = await PaymentHistory.findAll({
      where: { is_deleted: false },
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "full_name", "email"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    const payments = recentPayments.map((p) => ({
      id: p.id,
      tenantName: p.User?.full_name ?? "—",
      amount: Number(p.amount || 0),
      method: p.payment_method || "—",
      status: p.status,
      date: p.paid_at || p.created_at,
    }));

    // ── 7. Recent Tickets ──────────────────────────────────────────
    const recentTickets = await SupportTicket.findAll({
      where: { is_deleted: false },
      include: [
        { model: User, as: "CreatedByUser", attributes: ["id", "full_name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 10,
    });

    const tickets = recentTickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdBy: t.CreatedByUser?.full_name ?? "—",
      date:        t.get("created_at") || t.createdAt,
      createdDate: t.get("created_at") || t.createdAt,
      updatedDate: t.get("updated_at") || t.updatedAt,
    }));

    // ── Build response ────────────────────────────────────────────
    const formatCurrency = (val) => {
      if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
      return `$${val.toFixed(0)}`;
    };

    const data = {
      metrics: [
        {
          label: "Total Tenants",
          value: String(totalTenants),
          change: `${Number(tenantGrowth) >= 0 ? "+" : ""}${tenantGrowth}% this month`,
          trend: Number(tenantGrowth) > 0 ? "up" : Number(tenantGrowth) < 0 ? "down" : "neutral",
        },
        {
          label: "MRR",
          value: formatCurrency(mrr),
          change: `${Number(mrrChange) >= 0 ? "+" : ""}${mrrChange}% vs last month`,
          trend: Number(mrrChange) > 0 ? "up" : Number(mrrChange) < 0 ? "down" : "neutral",
        },
        {
          label: "Active Users",
          value: activeUsers.toLocaleString(),
          change: `+${newUsersLast30d} last 30d`,
          trend: newUsersLast30d > 0 ? "up" : "neutral",
        },
        {
          label: "Total Booked",
          value: totalBooked.toLocaleString(),
          change: "Won Leads",
          trend: totalBooked > 0 ? "up" : "neutral",
        },
      ],
      tenants,
      recentPayments: payments,
      recentTickets: tickets,
    };

    log.info(MODULE, "getDashboard", { userId: req.user.id });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getDashboard", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
