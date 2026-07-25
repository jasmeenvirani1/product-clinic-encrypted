const { PaymentHistory, User, Plan } = require("../models");
const log = require("../utils/logger");
const { APP_NAME } = require("../constants/brand");

const MODULE = "PaymentHistoryController";
const getStripeCurrency = () => "usd";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

let stripeClient = null;

function getStripeClient() {
  if (stripeClient) return stripeClient;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // Use account default API version for compatibility.
  stripeClient = require("stripe")(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

const PAYMENT_INCLUDE = [
  {
    model: User,
    as: "User",
    attributes: ["id", "full_name", "email", "tenant_id"],
  },
  {
    model: Plan,
    as: "Plan",
    attributes: ["id", "plan_name", "period", "monthly_price", "yearly_price"],
  },
];

function getTenantScopeId(user) {
  const role = user?.Role?.name;
  if (role === "super_admin") return user.id;
  return user.tenant_id || user.id;
}

function resolveUserScopeId(user) {
  return user?.tenant_id || user?.id || null;
}

function normalizeStatus(status) {
  const valid = ["pending", "paid", "failed", "refunded"];
  if (!status) return "paid";
  const s = String(status).toLowerCase().trim();
  if (!valid.includes(s)) return null;
  return s;
}

function normalizePeriod(period) {
  if (!period) return null;
  return String(period).toLowerCase().trim() === "yearly" ? "yearly" : "monthly";
}

function parseNonNegativeNumber(value, fieldName) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { error: `${fieldName} must be a valid non-negative number.` };
  }
  return { value: parsed };
}

function parseDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return { value: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { error: `${fieldName} is invalid.` };
  }
  return { value: d };
}

function addByPeriod(date, period) {
  const next = new Date(date);
  if (period === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

function buildPlanAccess(plan, period) {
  return {
    plan_id: plan.id,
    plan_name: plan.plan_name,
    period,
    features: Array.isArray(plan.features) ? plan.features : [],
  };
}

function toMinorUnit(amount) {
  const numberAmount = Number(amount || 0);
  return Math.round(numberAmount * 100);
}

function getBillingReturnBaseUrl(req) {
  const raw = process.env.FRONTEND_URL || process.env.CLIENT_URL || req.headers.origin || "http://localhost:3000";
  return String(raw).replace(/\/$/, "");
}

async function activatePlanForUser({ userId, planId, period, startedAt }) {
  const user = await User.findOne({ where: { id: Number(userId), is_deleted: false } });
  if (!user) return null;

  const plan = await Plan.findOne({ where: { id: Number(planId), is_deleted: false, is_active: true } });
  if (!plan) return null;

  const selectedPeriod = normalizePeriod(period) || "monthly";
  const planStartedAt = startedAt ? new Date(startedAt) : new Date();
  const planExpiresAt = addByPeriod(planStartedAt, selectedPeriod);

  user.plan_id = plan.id;
  user.plan_period = selectedPeriod;
  user.plan_started_at = planStartedAt;
  user.plan_expires_at = planExpiresAt;
  user.plan_access = buildPlanAccess(plan, selectedPeriod);
  await user.save();

  return {
    plan_id: user.plan_id,
    plan_period: user.plan_period,
    plan_started_at: user.plan_started_at,
    plan_expires_at: user.plan_expires_at,
    plan_access: user.plan_access,
  };
}


async function processStripeSessionResult({ session, source }) {
  const paymentHistoryId = Number(session?.metadata?.payment_history_id || 0);
  if (!(paymentHistoryId > 0)) {
    return { ok: false, message: "Invalid payment metadata." };
  }

  const payment = await PaymentHistory.findByPk(paymentHistoryId);
  if (!payment) {
    return { ok: false, message: "Payment history not found." };
  }

  const paidStatuses = ["paid", "no_payment_required"];
  const isPaid = paidStatuses.includes(String(session?.payment_status || "").toLowerCase());

  if (isPaid) {
    const paidAt = session?.created ? new Date(Number(session.created) * 1000) : new Date();

    payment.status = "paid";
    payment.payment_gateway = "stripe";
    payment.payment_method = "card";
    payment.paid_at = paidAt;
    payment.transaction_id = session.payment_intent || session.subscription || session.id || payment.transaction_id;
    payment.metadata = {
      ...(payment.metadata || {}),
      stripe_source: source,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      stripe_subscription_id: session.subscription || null,
      stripe_customer_id: session.customer || null,
      stripe_payment_status: session.payment_status || null,
    };
    await payment.save();

    // Persist Stripe IDs on the user for future renewals and reuse
    if (session.customer || session.subscription) {
      const paymentUser = await User.findByPk(payment.user_id);
      if (paymentUser) {
        if (session.customer && !paymentUser.stripe_customer_id) {
          paymentUser.stripe_customer_id = String(session.customer);
        }
        if (session.subscription) {
          paymentUser.stripe_subscription_id = String(session.subscription);
        }
        await paymentUser.save();
      }
    }

    const currentPlan = await activatePlanForUser({
      userId: payment.user_id,
      planId: payment.plan_id,
      period: payment.billing_period,
      startedAt: payment.paid_at || paidAt,
    });

    return { ok: true, status: "paid", payment, currentPlan };
  }

  if (payment.status !== "paid") {
    payment.status = "failed";
    payment.metadata = {
      ...(payment.metadata || {}),
      stripe_source: source,
      stripe_checkout_session_id: session.id || null,
      stripe_payment_status: session.payment_status || null,
    };
    await payment.save();
  }

  return { ok: true, status: "failed", payment, currentPlan: null };
}
exports.getStripeConfig = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || null,
        currency: getStripeCurrency(),
      },
    });
  } catch (err) {
    log.error(MODULE, "getStripeConfig", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.createStripeCheckoutSession = async (req, res) => {
  let payment = null;

  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe secret key is missing on server (STRIPE_SECRET_KEY).",
      });
    }

    const user = await User.findOne({ where: { id: req.user.id, is_deleted: false } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { plan_id, period, return_path } = req.body;
    if (!plan_id) {
      return res.status(400).json({ success: false, message: "plan_id is required." });
    }

    // Optional caller-supplied return path (must be a relative path for security)
    const safePath =
      typeof return_path === "string" && /^\/[a-zA-Z0-9/_-]/.test(return_path)
        ? return_path
        : "/app/billing";

    const plan = await Plan.findOne({ where: { id: Number(plan_id), is_deleted: false, is_active: true } });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found or inactive." });
    }

    const selectedPeriod = normalizePeriod(period) || plan.period || "monthly";
    const amount = selectedPeriod === "yearly" ? Number(plan.yearly_price || 0) : Number(plan.monthly_price || 0);

    if (!(amount > 0)) {
      return res.status(400).json({ success: false, message: "Selected plan amount must be greater than 0." });
    }

    const paidAt = new Date();
    const nextBillingAt = addByPeriod(paidAt, selectedPeriod);

    payment = await PaymentHistory.create({
      user_id: user.id,
      tenant_id: user.tenant_id || user.id,
      plan_id: plan.id,
      plan_name: plan.plan_name,
      billing_period: selectedPeriod,
      amount,
      currency: getStripeCurrency().toUpperCase(),
      payment_method: "card",
      payment_gateway: "stripe",
      transaction_id: `STRIPE-PENDING-${Date.now()}`,
      status: "pending",
      paid_at: null,
      next_billing_at: nextBillingAt,
      notes: "Stripe checkout initiated",
      metadata: { source: "billing-ui" },
      is_active: true,
    });

    const baseReturnUrl = getBillingReturnBaseUrl(req);

    // Reuse existing Stripe customer if available to avoid duplicates
    const customerParam = user.stripe_customer_id
      ? { customer: user.stripe_customer_id }
      : { customer_email: user.email };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: getStripeCurrency(),
            product_data: {
              name: `${plan.plan_name} (${selectedPeriod})`,
              description: `${APP_NAME} ${selectedPeriod} subscription`,
            },
            unit_amount: toMinorUnit(amount),
            recurring: {
              interval: selectedPeriod === "yearly" ? "year" : "month",
            },
          },
        },
      ],
      ...customerParam,
      subscription_data: {
        metadata: {
          user_id: String(user.id),
          tenant_id: String(user.tenant_id || user.id),
          plan_id: String(plan.id),
          plan_name: plan.plan_name,
          billing_period: selectedPeriod,
        },
      },
      metadata: {
        payment_history_id: String(payment.id),
        user_id: String(user.id),
        tenant_id: String(user.tenant_id || user.id),
        plan_id: String(plan.id),
        billing_period: selectedPeriod,
      },
      success_url: `${baseReturnUrl}${safePath}?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseReturnUrl}${safePath}?stripe_status=cancelled&payment_id=${payment.id}`,
    });

    // Persist the Stripe customer ID so we can reuse it on future checkouts
    if (session.customer && !user.stripe_customer_id) {
      user.stripe_customer_id = String(session.customer);
      await user.save();
    }

    payment.transaction_id = session.subscription || session.payment_intent || session.id;
    payment.metadata = {
      ...(payment.metadata || {}),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      stripe_subscription_id: session.subscription || null,
      stripe_customer_id: session.customer || null,
    };
    await payment.save();

    log.info(MODULE, "createStripeCheckoutSession", {
      userId: req.user.id,
      planId: plan.id,
      period: selectedPeriod,
      paymentId: payment.id,
      sessionId: session.id,
    });

    return res.status(200).json({
      success: true,
      message: "Stripe checkout session created.",
      data: {
        payment_id: payment.id,
        session_id: session.id,
        checkout_url: session.url,
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
      },
    });
  } catch (err) {
    if (payment) {
      payment.status = "failed";
      payment.notes = "Stripe checkout session creation failed";
      payment.metadata = {
        ...(payment.metadata || {}),
        stripe_error: err.message,
      };
      await payment.save();
    }

    log.error(MODULE, "createStripeCheckoutSession", { error: err.message });
    return res.status(500).json({ success: false, message: "Unable to create Stripe checkout session." });
  }
};


exports.confirmStripeCheckoutSession = async (req, res) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ success: false, message: "Stripe is not configured on server." });
    }

    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ success: false, message: "session_id is required." });
    }

    const session = await stripe.checkout.sessions.retrieve(String(session_id));
    if (!session) {
      return res.status(404).json({ success: false, message: "Stripe session not found." });
    }

    const paymentHistoryId = Number(session?.metadata?.payment_history_id || 0);
    if (!(paymentHistoryId > 0)) {
      return res.status(400).json({ success: false, message: "Invalid payment metadata." });
    }

    const payment = await PaymentHistory.findByPk(paymentHistoryId);
    if (!payment || payment.is_deleted) {
      return res.status(404).json({ success: false, message: "Payment history not found." });
    }

    if (payment.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "You cannot confirm this payment." });
    }

    const result = await processStripeSessionResult({ session, source: "confirm-session" });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message || "Unable to confirm session." });
    }

    const freshPayment = await PaymentHistory.findByPk(payment.id, { include: PAYMENT_INCLUDE });

    return res.status(200).json({
      success: true,
      message: result.status === "paid" ? "Payment confirmed and plan activated." : "Payment not completed.",
      data: {
        status: result.status,
        payment: freshPayment,
        current_plan: result.currentPlan,
      },
    });
  } catch (err) {
    log.error(MODULE, "confirmStripeCheckoutSession", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
exports.stripeWebhook = async (req, res) => {
  try {
    const stripe = getStripeClient();
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ success: false, message: "Stripe webhook is not configured." });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ success: false, message: "Missing Stripe signature." });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      log.error(MODULE, "stripeWebhook.verify", { error: err.message });
      return res.status(400).json({ success: false, message: "Invalid Stripe signature." });
    }

    const eventType = event.type;
    const session = event.data?.object;

    if (
      eventType === "checkout.session.completed" ||
      eventType === "checkout.session.async_payment_succeeded"
    ) {
      const paymentHistoryId = Number(session?.metadata?.payment_history_id || 0);
      if (paymentHistoryId > 0) {
        const payment = await PaymentHistory.findByPk(paymentHistoryId);
        if (payment) {
          const paidAt = session?.created ? new Date(Number(session.created) * 1000) : new Date();

          payment.status = "paid";
          payment.payment_gateway = "stripe";
          payment.payment_method = "card";
          payment.paid_at = paidAt;
          payment.transaction_id = session.payment_intent || session.subscription || session.id || payment.transaction_id;
          payment.metadata = {
            ...(payment.metadata || {}),
            stripe_event_id: event.id,
            stripe_event_type: eventType,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent: session.payment_intent || null,
            stripe_subscription_id: session.subscription || null,
            stripe_customer_id: session.customer || null,
            stripe_payment_status: session.payment_status || null,
          };
          await payment.save();

          // Persist Stripe customer + subscription IDs on user
          if (session.customer || session.subscription) {
            const paymentUser = await User.findByPk(payment.user_id);
            if (paymentUser) {
              if (session.customer && !paymentUser.stripe_customer_id) {
                paymentUser.stripe_customer_id = String(session.customer);
              }
              if (session.subscription) {
                paymentUser.stripe_subscription_id = String(session.subscription);
              }
              await paymentUser.save();
            }
          }

          await activatePlanForUser({
            userId: payment.user_id,
            planId: payment.plan_id,
            period: payment.billing_period,
            startedAt: payment.paid_at || paidAt,
          });
        }
      }
    }

    if (
      eventType === "checkout.session.expired" ||
      eventType === "checkout.session.async_payment_failed"
    ) {
      const paymentHistoryId = Number(session?.metadata?.payment_history_id || 0);
      if (paymentHistoryId > 0) {
        const payment = await PaymentHistory.findByPk(paymentHistoryId);
        if (payment && payment.status !== "paid") {
          payment.status = "failed";
          payment.metadata = {
            ...(payment.metadata || {}),
            stripe_event_id: event.id,
            stripe_event_type: eventType,
            stripe_checkout_session_id: session.id || null,
          };
          await payment.save();
        }
      }
    }

    // Auto-renewal: fires every billing cycle after the first payment
    if (eventType === "invoice.paid") {
      const invoice = event.data.object;

      // Skip first invoice — already handled by checkout.session.completed
      if (invoice.billing_reason === "subscription_create") {
        return res.status(200).json({ received: true });
      }

      const subscriptionId = invoice.subscription;
      if (!subscriptionId) {
        return res.status(200).json({ received: true });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = Number(subscription.metadata?.user_id || 0);
      const planId = Number(subscription.metadata?.plan_id || 0);
      const billingPeriod = subscription.metadata?.billing_period || "monthly";
      const tenantId = Number(subscription.metadata?.tenant_id || userId);
      const planName = subscription.metadata?.plan_name || null;

      if (!(userId > 0) || !(planId > 0)) {
        log.error(MODULE, "stripeWebhook.invoice.paid", { message: "Missing user_id or plan_id in subscription metadata", subscriptionId });
        return res.status(200).json({ received: true });
      }

      const paidAt = invoice.created ? new Date(Number(invoice.created) * 1000) : new Date();
      const amount = invoice.amount_paid ? invoice.amount_paid / 100 : 0;

      await PaymentHistory.create({
        user_id: userId,
        tenant_id: tenantId,
        plan_id: planId,
        plan_name: planName,
        billing_period: billingPeriod,
        amount,
        currency: (invoice.currency || getStripeCurrency()).toUpperCase(),
        payment_method: "card",
        payment_gateway: "stripe",
        transaction_id: invoice.payment_intent || invoice.id,
        status: "paid",
        paid_at: paidAt,
        next_billing_at: addByPeriod(paidAt, billingPeriod),
        notes: "Auto-renewal via Stripe subscription",
        metadata: {
          stripe_event_id: event.id,
          stripe_event_type: eventType,
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: invoice.customer || null,
          billing_reason: invoice.billing_reason,
        },
        is_active: true,
      });

      await activatePlanForUser({ userId, planId, period: billingPeriod, startedAt: paidAt });

      log.info(MODULE, "stripeWebhook.invoice.paid", { userId, planId, billingPeriod, subscriptionId });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    log.error(MODULE, "stripeWebhook", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getAll = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);
    const where = { is_deleted: false };

    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
      // Billing history for tenant/staff is always personal purchase history.
      where.user_id = req.user.id;
    } else if (req.query.tenant_id) {
      where.tenant_id = Number(req.query.tenant_id);
    }

    if (role === "super_admin" && req.query.user_id) where.user_id = Number(req.query.user_id);
    if (req.query.status) {
      const status = normalizeStatus(req.query.status);
      if (!status) {
        return res.status(400).json({ success: false, message: "Invalid status filter." });
      }
      where.status = status;
    }

    log.info(MODULE, "getAll", { userId: req.user.id, role, where });

    const rows = await PaymentHistory.findAll({
      where,
      include: PAYMENT_INCLUDE,
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getById = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);

    const where = { id: req.params.id, is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
      where.user_id = req.user.id;
    }

    const row = await PaymentHistory.findOne({ where, include: PAYMENT_INCLUDE });
    if (!row) {
      return res.status(404).json({ success: false, message: "Payment history not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.create = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);

    const {
      user_id,
      plan_id,
      plan_name,
      billing_period,
      amount,
      currency,
      payment_method,
      payment_gateway,
      transaction_id,
      status,
      paid_at,
      next_billing_at,
      notes,
      metadata,
    } = req.body;

    const parsedAmount = parseNonNegativeNumber(amount, "amount");
    if (parsedAmount.error) {
      return res.status(400).json({ success: false, message: parsedAmount.error });
    }

    const resolvedStatus = normalizeStatus(status);
    if (!resolvedStatus) {
      return res.status(400).json({ success: false, message: "status is invalid." });
    }

    const paidAt = parseDate(paid_at, "paid_at");
    if (paidAt.error) {
      return res.status(400).json({ success: false, message: paidAt.error });
    }

    const nextBillingAt = parseDate(next_billing_at, "next_billing_at");
    if (nextBillingAt.error) {
      return res.status(400).json({ success: false, message: nextBillingAt.error });
    }

    const targetUserId = user_id ? Number(user_id) : req.user.id;
    const targetUser = await User.findOne({ where: { id: targetUserId, is_deleted: false } });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Target user not found." });
    }

    const targetUserScope = resolveUserScopeId(targetUser);
    if (role !== "super_admin" && targetUserScope !== tenantScopeId) {
      return res.status(403).json({ success: false, message: "You cannot add payment for this user." });
    }

    let targetPlan = null;
    if (plan_id) {
      targetPlan = await Plan.findOne({ where: { id: Number(plan_id), is_deleted: false } });
      if (!targetPlan) {
        return res.status(404).json({ success: false, message: "Plan not found." });
      }
    } else if (targetUser.plan_id) {
      targetPlan = await Plan.findOne({ where: { id: targetUser.plan_id, is_deleted: false } });
    }

    const resolvedPlanName = plan_name || targetPlan?.plan_name || null;
    const resolvedPeriod = normalizePeriod(billing_period) || targetUser.plan_period || targetPlan?.period || null;

    const row = await PaymentHistory.create({
      user_id: targetUser.id,
      tenant_id: role === "super_admin" ? (targetUserScope || tenantScopeId) : tenantScopeId,
      plan_id: targetPlan?.id || null,
      plan_name: resolvedPlanName,
      billing_period: resolvedPeriod,
      amount: parsedAmount.value,
      currency: currency ? String(currency).toUpperCase().trim() : "USD",
      payment_method: payment_method || null,
      payment_gateway: payment_gateway || null,
      transaction_id: transaction_id || null,
      status: resolvedStatus,
      paid_at: paidAt.value,
      next_billing_at: nextBillingAt.value,
      notes: notes || null,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      is_active: true,
    });

    const created = await PaymentHistory.findByPk(row.id, { include: PAYMENT_INCLUDE });

    log.info(MODULE, "create", { userId: req.user.id, role, paymentId: row.id, targetUserId: targetUser.id });
    return res.status(201).json({ success: true, message: "Payment history stored.", data: created });
  } catch (err) {
    log.error(MODULE, "create", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Manual purchase flow (no payment gateway):
// 1) create paid payment history
// 2) update user's currently running plan fields
exports.purchasePlan = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.user.id, is_deleted: false } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { plan_id, period, payment_method } = req.body;
    if (!plan_id) {
      return res.status(400).json({ success: false, message: "plan_id is required." });
    }

    const plan = await Plan.findOne({ where: { id: Number(plan_id), is_deleted: false, is_active: true } });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found or inactive." });
    }

    const selectedPeriod = normalizePeriod(period) || plan.period || "monthly";
    const amount = selectedPeriod === "yearly" ? Number(plan.yearly_price || 0) : Number(plan.monthly_price || 0);

    const paidAt = new Date();
    const nextBillingAt = addByPeriod(paidAt, selectedPeriod);

    const payment = await PaymentHistory.create({
      user_id: user.id,
      tenant_id: user.tenant_id || user.id,
      plan_id: plan.id,
      plan_name: plan.plan_name,
      billing_period: selectedPeriod,
      amount,
      currency: "USD",
      payment_method: payment_method || "manual",
      payment_gateway: "manual",
      transaction_id: `MANUAL-${Date.now()}`,
      status: "paid",
      paid_at: paidAt,
      next_billing_at: nextBillingAt,
      notes: "Manual purchase without payment gateway",
      metadata: { source: "billing-ui" },
      is_active: true,
    });

    user.plan_id = plan.id;
    user.plan_period = selectedPeriod;
    user.plan_started_at = paidAt;
    user.plan_expires_at = nextBillingAt;
    user.plan_access = buildPlanAccess(plan, selectedPeriod);
    await user.save();

    const created = await PaymentHistory.findByPk(payment.id, { include: PAYMENT_INCLUDE });

    log.info(MODULE, "purchasePlan", { userId: req.user.id, planId: plan.id, period: selectedPeriod, paymentId: payment.id });

    return res.status(201).json({
      success: true,
      message: "Plan purchased successfully.",
      data: {
        payment: created,
        current_plan: {
          plan_id: user.plan_id,
          plan_period: user.plan_period,
          plan_started_at: user.plan_started_at,
          plan_expires_at: user.plan_expires_at,
          plan_access: user.plan_access,
        },
      },
    });
  } catch (err) {
    log.error(MODULE, "purchasePlan", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);

    const where = { id: req.params.id, is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
      where.user_id = req.user.id;
    }

    const row = await PaymentHistory.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: "Payment history not found." });
    }

    const {
      plan_id,
      plan_name,
      billing_period,
      amount,
      currency,
      payment_method,
      payment_gateway,
      transaction_id,
      status,
      paid_at,
      next_billing_at,
      notes,
      metadata,
      is_active,
    } = req.body;

    if (plan_id !== undefined) {
      if (!plan_id) {
        row.plan_id = null;
        row.plan_name = plan_name || null;
      } else {
        const targetPlan = await Plan.findOne({ where: { id: Number(plan_id), is_deleted: false } });
        if (!targetPlan) {
          return res.status(404).json({ success: false, message: "Plan not found." });
        }
        row.plan_id = targetPlan.id;
        row.plan_name = plan_name || targetPlan.plan_name;
      }
    } else if (plan_name !== undefined) {
      row.plan_name = plan_name || null;
    }

    if (billing_period !== undefined) {
      row.billing_period = normalizePeriod(billing_period);
    }

    if (amount !== undefined) {
      const parsedAmount = parseNonNegativeNumber(amount, "amount");
      if (parsedAmount.error) {
        return res.status(400).json({ success: false, message: parsedAmount.error });
      }
      row.amount = parsedAmount.value;
    }

    if (currency !== undefined) row.currency = currency ? String(currency).toUpperCase().trim() : "USD";
    if (payment_method !== undefined) row.payment_method = payment_method || null;
    if (payment_gateway !== undefined) row.payment_gateway = payment_gateway || null;
    if (transaction_id !== undefined) row.transaction_id = transaction_id || null;

    if (status !== undefined) {
      const resolvedStatus = normalizeStatus(status);
      if (!resolvedStatus) {
        return res.status(400).json({ success: false, message: "status is invalid." });
      }
      row.status = resolvedStatus;
    }

    if (paid_at !== undefined) {
      const paidAt = parseDate(paid_at, "paid_at");
      if (paidAt.error) {
        return res.status(400).json({ success: false, message: paidAt.error });
      }
      row.paid_at = paidAt.value;
    }

    if (next_billing_at !== undefined) {
      const nextBillingAt = parseDate(next_billing_at, "next_billing_at");
      if (nextBillingAt.error) {
        return res.status(400).json({ success: false, message: nextBillingAt.error });
      }
      row.next_billing_at = nextBillingAt.value;
    }

    if (notes !== undefined) row.notes = notes || null;
    if (metadata !== undefined) row.metadata = metadata && typeof metadata === "object" ? metadata : {};
    if (is_active !== undefined) row.is_active = !!is_active;

    await row.save();

    const updated = await PaymentHistory.findByPk(row.id, { include: PAYMENT_INCLUDE });
    return res.status(200).json({ success: true, message: "Payment history updated.", data: updated });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    const role = req.user.Role?.name;
    const tenantScopeId = getTenantScopeId(req.user);

    const where = { id: req.params.id, is_deleted: false };
    if (role !== "super_admin") {
      where.tenant_id = tenantScopeId;
      where.user_id = req.user.id;
    }

    const row = await PaymentHistory.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: "Payment history not found." });
    }

    row.is_deleted = true;
    row.is_active = false;
    await row.save();

    return res.status(200).json({ success: true, message: "Payment history deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};



