require("dotenv").config();
const { sequelize, User, Plan, PaymentHistory } = require("../models");

(async () => {
  try {
    await sequelize.authenticate();

    const user = await User.findOne({ where: { email: "john@gmail.com", is_deleted: false } });
    if (!user) {
      console.log(JSON.stringify({ success: false, message: "User john@gmail.com not found" }, null, 2));
      return;
    }

    let plan = null;
    if (user.plan_id) {
      plan = await Plan.findOne({ where: { id: user.plan_id, is_deleted: false, is_active: true } });
    }
    if (!plan) {
      plan = await Plan.findOne({ where: { is_deleted: false, is_active: true }, order: [["id", "ASC"]] });
    }

    if (!plan) {
      console.log(JSON.stringify({ success: false, message: "No active plan found" }, null, 2));
      return;
    }

    const period = user.plan_period === "yearly" ? "yearly" : (plan.period === "yearly" ? "yearly" : "monthly");
    const now = new Date();
    const expires = new Date(now);
    if (period === "yearly") expires.setFullYear(expires.getFullYear() + 1);
    else expires.setMonth(expires.getMonth() + 1);

    user.plan_id = plan.id;
    user.plan_period = period;
    user.plan_started_at = now;
    user.plan_expires_at = expires;
    user.plan_access = {
      plan_id: plan.id,
      plan_name: plan.plan_name,
      period,
      leads: Number(plan.leads || 0),
      ai_credits: Number(plan.ai_credits || 0),
      features: Array.isArray(plan.features) ? plan.features : [],
    };

    await user.save();

    const amount = period === "yearly" ? Number(plan.yearly_price || 0) : Number(plan.monthly_price || 0);

    const payment = await PaymentHistory.create({
      user_id: user.id,
      tenant_id: user.tenant_id || user.id,
      plan_id: plan.id,
      plan_name: plan.plan_name,
      billing_period: period,
      amount,
      currency: "INR",
      payment_method: "manual",
      payment_gateway: "internal",
      transaction_id: `MANUAL-${Date.now()}`,
      status: "paid",
      paid_at: now,
      next_billing_at: expires,
      notes: "Manual entry for subscription linking",
      metadata: { source: "admin-script" },
      is_active: true,
    });

    console.log(JSON.stringify({
      success: true,
      message: "User updated and payment history created",
      user: {
        id: user.id,
        email: user.email,
        plan_id: user.plan_id,
        plan_period: user.plan_period,
        plan_started_at: user.plan_started_at,
        plan_expires_at: user.plan_expires_at,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        status: payment.status,
        plan_name: payment.plan_name,
      }
    }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ success: false, message: e.message }, null, 2));
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();

