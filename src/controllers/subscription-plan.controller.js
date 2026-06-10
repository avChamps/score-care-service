const {
  listActiveSubscriptionPlans,
  listAllSubscriptionPlans,
  updateSubscriptionPlanByPublicId
} = require("../models/subscription-plan.model");

async function getSubscriptionPlans(_req, res, next) {
  try {
    const plans = await listActiveSubscriptionPlans();

    return res.status(200).json({
      status: "success",
      data: {
        plans
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAllSubscriptionPlans(_req, res, next) {
  try {
    const plans = await listAllSubscriptionPlans();

    return res.status(200).json({
      status: "success",
      data: {
        plans
      }
    });
  } catch (error) {
    next(error);
  }
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return null;
}

function validateSubscriptionPlanPayload(body) {
  const errors = [];
  const value = {};

  if (Object.prototype.hasOwnProperty.call(body, "planName")) {
    value.planName = String(body.planName || "").trim();

    if (!value.planName) {
      errors.push("planName is required");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "amount")) {
    value.amount = Number(body.amount);

    if (!Number.isFinite(value.amount) || value.amount < 0) {
      errors.push("amount must be a valid non-negative number");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    value.currency = String(body.currency || "").trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(value.currency)) {
      errors.push("currency must be a 3-letter currency code");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "offerTag")) {
    value.offerTag = body.offerTag === null
      ? null
      : String(body.offerTag).trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "recommendedFor")) {
    value.recommendedFor = body.recommendedFor === null
      ? null
      : String(body.recommendedFor).trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayOrder")) {
    value.displayOrder = Number(body.displayOrder);

    if (!Number.isInteger(value.displayOrder) || value.displayOrder < 0) {
      errors.push("displayOrder must be a non-negative integer");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    value.isActive = parseOptionalBoolean(body.isActive);

    if (value.isActive === null) {
      errors.push("isActive must be a boolean");
    }
  }

  if (Object.keys(value).length === 0) {
    errors.push("At least one subscription plan field is required");
  }

  return { errors, value };
}

async function updateSubscriptionPlan(req, res, next) {
  try {
    const { errors, value } = validateSubscriptionPlanPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const plan = await updateSubscriptionPlanByPublicId(
      req.params.publicId,
      value
    );

    if (!plan) {
      return res.status(404).json({
        status: "error",
        message: "Subscription plan not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Subscription plan updated successfully",
      data: {
        plan
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: "error",
        message: "Subscription plan already exists"
      });
    }

    next(error);
  }
}

module.exports = {
  getAllSubscriptionPlans,
  getSubscriptionPlans,
  updateSubscriptionPlan
};
