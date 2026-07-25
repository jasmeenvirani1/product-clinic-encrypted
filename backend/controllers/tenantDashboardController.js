const { Op } = require("sequelize");
const { Lead, SupportTicket, User } = require("../models");
const log = require("../utils/logger");

const MODULE = "TenantDashboardController";

exports.getDashboard = async (req, res) => {
  try {
    const role     = req.user.Role?.name;
    const tenantId = req.user.tenant_id || req.user.id;
    const now      = new Date();
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Lead scope (must match leadController.getAll logic exactly) ─
    const leadWhere = { is_deleted: false };
    if (role === "super_admin") {
      // super_admin sees everything
    } else if (role === "tenant_admin") {
      leadWhere.created_by = req.user.id;
    } else {
      // staff_user: only assigned leads
      leadWhere.assigned_to = req.user.id;
    }

    log.info(MODULE, "getDashboard:leadWhere", { userId: req.user.id, role, tenant_id: req.user.tenant_id, leadWhere });

    const allLeads = await Lead.findAll({
      where: leadWhere,
      attributes: ["id", "name", "source", "stage", "created_at"],
      order: [["created_at", "DESC"]],
    });

    const totalLeads   = allLeads.length;
    const leadsToday   = allLeads.filter((l) => new Date(l.get("created_at") || l.createdAt) >= todayStart).length;
    const leadsLast30d = allLeads.filter((l) => new Date(l.get("created_at") || l.createdAt) >= thirtyDaysAgo).length;

    // Funnel counts
    const stages = ["new", "qualified", "discussion", "won", "lost"];
    const funnel = stages.map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: allLeads.filter((l) => l.stage === s).length,
    }));

    const wonCount = funnel.find((f) => f.label === "Won")?.value ?? 0;
    const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : "0";

    // Recent leads (top 5)
    const recentLeads = allLeads.slice(0, 5).map((l) => ({
      id:        l.id,
      name:      l.name,
      source:    l.source || "—",
      stage:     l.stage,
      date:      l.get("created_at") || l.createdAt,
      createdAt: l.get("created_at") || l.createdAt,
    }));

    // ── Support tickets scope (match supportController.getAll) ────
    const ticketWhere = { is_deleted: false };
    if (role === "super_admin") {
      // sees all
    } else {
      ticketWhere.tenant_id = req.user.tenant_id || req.user.id;
    }

    const allTickets = await SupportTicket.findAll({
      where: ticketWhere,
      attributes: ["id", "subject", "status", "created_at", "updated_at"],
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    const recentTickets = allTickets.map((t) => ({
      id:           t.id,
      subject:      t.subject,
      status:       t.status,
      date:         t.get("created_at") || t.createdAt,
      createdDate:  t.get("created_at") || t.createdAt,
      updatedDate:  t.get("updated_at") || t.updatedAt,
    }));

    // ── Total tenant users count (users under this tenant) ─────
    const totalTenantUsers = await User.count({
      where: { tenant_id: tenantId, is_deleted: false, is_active: true },
    });

    // ── Team members count ────────────────────────────────────────
    let teamCount = 0;
    if (role === "tenant_admin" && req.user.tenant_id) {
      teamCount = await User.count({
        where: { tenant_id: req.user.tenant_id, is_deleted: false, is_active: true },
      });
    }

    // ── Build response ────────────────────────────────────────────
    const data = {
      tenantName: req.user.full_name || "Clinic Dashboard",
      metrics: [
        {
          label: "Total Leads",
          value: String(totalLeads),
          change: `+${leadsToday} today`,
          trend: leadsToday > 0 ? "up" : "neutral",
          _dynamic: true,
        },
        {
          label: "Conversions",
          value: `${wonCount}`,
          change: `${conversionRate}% conversion rate`,
          trend: Number(conversionRate) > 0 ? "up" : "neutral",
          _dynamic: true,
        },
        ...(role === "tenant_admin" || role === "super_admin"
          ? [
              {
                label: "Total Booked",
                value: String(wonCount),
                change: "Won leads only",
                trend: wonCount > 0 ? "up" : "neutral",
                _dynamic: true,
              },
              {
                label: "Total Users",
                value: String(totalTenantUsers),
                change: `${totalTenantUsers} active users`,
                trend: totalTenantUsers > 0 ? "up" : "neutral",
                _dynamic: true,
              },
            ]
          : []),
      ],
      funnel,
      recentLeads,
      recentTickets,
      teamCount,
    };

    log.info(MODULE, "getDashboard", { userId: req.user.id, tenantId });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    log.error(MODULE, "getDashboard", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
