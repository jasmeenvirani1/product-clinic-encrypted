const { Plan } = require("../models");
const log = require("../utils/logger");

const MODULE = "PlanController";

const normalizeFeatures = (features) => {
  if (Array.isArray(features)) {
    return features.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof features === "string") {
    return features
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const parseNonNegativeNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return { error: `${fieldName} must be a valid non-negative number.` };
  }
  return { value: parsed };
};

const resolvePrices = ({ price, monthly_price, yearly_price, period }) => {
  const resolvedPeriod = period === "yearly" ? "yearly" : "monthly";

  const basePrice = price === undefined || price === null
    ? null
    : parseNonNegativeNumber(price, "price");
  if (basePrice?.error) return { error: basePrice.error };

  const monthly = monthly_price === undefined || monthly_price === null
    ? null
    : parseNonNegativeNumber(monthly_price, "monthly_price");
  if (monthly?.error) return { error: monthly.error };

  const yearly = yearly_price === undefined || yearly_price === null
    ? null
    : parseNonNegativeNumber(yearly_price, "yearly_price");
  if (yearly?.error) return { error: yearly.error };

  const resolvedMonthly = monthly?.value ?? (resolvedPeriod === "monthly" ? basePrice?.value ?? 0 : 0);
  const resolvedYearly = yearly?.value ?? (resolvedPeriod === "yearly" ? basePrice?.value ?? 0 : 0);
  const resolvedPrice = resolvedPeriod === "yearly" ? resolvedYearly : resolvedMonthly;

  return {
    value: {
      price: resolvedPrice,
      monthly_price: resolvedMonthly,
      yearly_price: resolvedYearly,
      period: resolvedPeriod,
    },
  };
};

exports.create = async (req, res) => {
  try {
    const { plan_name, price, monthly_price, yearly_price, period, campaign_count, features } = req.body;

    log.info(MODULE, "create", {
      userId: req.user.id,
      plan_name,
      period,
      price,
      monthly_price,
      yearly_price,
      campaign_count,
    });

    if (!plan_name) {
      return res.status(400).json({ success: false, message: "plan_name is required." });
    }

    const prices = resolvePrices({ price, monthly_price, yearly_price, period });
    if (prices.error) {
      return res.status(400).json({ success: false, message: prices.error });
    }

    const parsedCampaignCount = campaign_count === undefined
      ? { value: 0 }
      : parseNonNegativeNumber(campaign_count, "campaign_count");
    if (parsedCampaignCount.error) {
      return res.status(400).json({ success: false, message: parsedCampaignCount.error });
    }

    const normalizedName = plan_name.trim();

    // Handle both active and soft-deleted duplicates safely.
    const existingAny = await Plan.findOne({ where: { plan_name: normalizedName } });

    if (existingAny && !existingAny.is_deleted) {
      return res.status(409).json({ success: false, message: "Plan already exists." });
    }

    if (existingAny && existingAny.is_deleted) {
      existingAny.price = prices.value.price;
      existingAny.monthly_price = prices.value.monthly_price;
      existingAny.yearly_price = prices.value.yearly_price;
      existingAny.period = prices.value.period;
      existingAny.campaign_count = parsedCampaignCount.value;
      existingAny.features = normalizeFeatures(features);
      existingAny.is_active = true;
      existingAny.is_deleted = false;
      await existingAny.save();

      return res.status(200).json({
        success: true,
        message: "Plan restored and updated.",
        data: existingAny,
      });
    }

    const plan = await Plan.create({
      plan_name: normalizedName,
      price: prices.value.price,
      monthly_price: prices.value.monthly_price,
      yearly_price: prices.value.yearly_price,
      period: prices.value.period,
      campaign_count: parsedCampaignCount.value,
      features: normalizeFeatures(features),
      is_active: true,
    });

    return res.status(201).json({ success: true, message: "Plan created.", data: plan });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Plan name already exists. Use a different plan_name.",
      });
    }

    log.error(MODULE, "create", {
      error: err.message,
      errorName: err.name,
      details: err.errors?.map((e) => e.message).join(" | "),
    });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getAll = async (req, res) => {
  try {
    log.info(MODULE, "getAll", { userId: req.user.id });

    const plans = await Plan.findAll({
      where: { is_deleted: false },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({ success: true, data: plans });
  } catch (err) {
    log.error(MODULE, "getAll", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.getById = async (req, res) => {
  try {
    log.info(MODULE, "getById", { userId: req.user.id, targetId: req.params.id });

    const plan = await Plan.findOne({
      where: { id: req.params.id, is_deleted: false },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    log.error(MODULE, "getById", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.update = async (req, res) => {
  try {
    log.info(MODULE, "update", { userId: req.user.id, targetId: req.params.id, body: req.body });

    const plan = await Plan.findOne({
      where: { id: req.params.id, is_deleted: false },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    const { plan_name, price, monthly_price, yearly_price, period, campaign_count, features, is_active } = req.body;

    if (plan_name !== undefined) {
      const nextName = String(plan_name).trim();
      if (!nextName) {
        return res.status(400).json({ success: false, message: "plan_name cannot be empty." });
      }

      const existing = await Plan.findOne({ where: { plan_name: nextName } });
      if (existing && existing.id !== plan.id && !existing.is_deleted) {
        return res.status(409).json({ success: false, message: "Plan name already exists." });
      }

      plan.plan_name = nextName;
    }

    if (price !== undefined || monthly_price !== undefined || yearly_price !== undefined || period !== undefined) {
      const prices = resolvePrices({
        price: price !== undefined ? price : plan.price,
        monthly_price: monthly_price !== undefined ? monthly_price : plan.monthly_price,
        yearly_price: yearly_price !== undefined ? yearly_price : plan.yearly_price,
        period: period !== undefined ? period : plan.period,
      });

      if (prices.error) {
        return res.status(400).json({ success: false, message: prices.error });
      }

      plan.price = prices.value.price;
      plan.monthly_price = prices.value.monthly_price;
      plan.yearly_price = prices.value.yearly_price;
      plan.period = prices.value.period;
    }

    if (campaign_count !== undefined) {
      const parsedCampaignCount = parseNonNegativeNumber(campaign_count, "campaign_count");
      if (parsedCampaignCount.error) {
        return res.status(400).json({ success: false, message: parsedCampaignCount.error });
      }
      plan.campaign_count = parsedCampaignCount.value;
    }

    if (features !== undefined) {
      plan.features = normalizeFeatures(features);
    }

    if (is_active !== undefined) {
      plan.is_active = is_active;
    }

    await plan.save();

    return res.status(200).json({ success: true, message: "Plan updated.", data: plan });
  } catch (err) {
    log.error(MODULE, "update", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.remove = async (req, res) => {
  try {
    log.info(MODULE, "remove", { userId: req.user.id, targetId: req.params.id });

    const plan = await Plan.findOne({
      where: { id: req.params.id, is_deleted: false },
    });

    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    plan.is_deleted = true;
    plan.is_active = false;
    await plan.save();

    return res.status(200).json({ success: true, message: "Plan deleted." });
  } catch (err) {
    log.error(MODULE, "remove", { error: err.message });
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
