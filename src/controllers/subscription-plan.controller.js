const {
  createSubscriptionPlan,
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

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === null ? null : normalizeString(value) || null;
}

function normalizeStringArray(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function validateSubscriptionPlanPayload(body, { isCreate = false } = {}) {
  const errors = [];
  const value = {};

  if (isCreate) {
    value.publicId = normalizeString(body.publicId);

    if (!value.publicId) {
      errors.push("publicId is required");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "planName")) {
    value.planName = normalizeString(body.planName);

    if (!value.planName) {
      errors.push("planName is required");
    }
  } else if (isCreate) {
    errors.push("planName is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "amount")) {
    value.amount = Number(body.amount);

    if (!Number.isFinite(value.amount) || value.amount < 0) {
      errors.push("amount must be a valid non-negative number");
    }
  } else if (isCreate) {
    errors.push("amount is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    value.currency = normalizeString(body.currency).toUpperCase();

    if (!/^[A-Z]{3}$/.test(value.currency)) {
      errors.push("currency must be a 3-letter currency code");
    }
  } else if (isCreate) {
    value.currency = "INR";
  }

  if (Object.prototype.hasOwnProperty.call(body, "offerTag")) {
    value.offerTag = normalizeNullableString(body.offerTag);
  }

  if (Object.prototype.hasOwnProperty.call(body, "recommendedFor")) {
    value.recommendedFor = normalizeNullableString(body.recommendedFor);
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    value.title = normalizeNullableString(body.title);
  }

  if (Object.prototype.hasOwnProperty.call(body, "subtitle")) {
    value.subtitle = normalizeNullableString(body.subtitle);
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    value.description = normalizeNullableString(body.description);
  }

  if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
    value.imageUrl = normalizeNullableString(body.imageUrl);
  }

  if (Object.prototype.hasOwnProperty.call(body, "benefits")) {
    value.benefits = normalizeStringArray(body.benefits);

    if (value.benefits === null) {
      errors.push("benefits must be an array");
    }
  } else if (isCreate) {
    value.benefits = [];
  }

  if (Object.prototype.hasOwnProperty.call(body, "features")) {
    value.features = normalizeStringArray(body.features);

    if (value.features === null) {
      errors.push("features must be an array");
    }
  } else if (isCreate) {
    value.features = [];
  }

  if (Object.prototype.hasOwnProperty.call(body, "buttonLabel")) {
    value.buttonLabel = normalizeNullableString(body.buttonLabel);
  }

  if (Object.prototype.hasOwnProperty.call(body, "skipLabel")) {
    value.skipLabel = normalizeNullableString(body.skipLabel);
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayOrder")) {
    value.displayOrder = Number(body.displayOrder);

    if (!Number.isInteger(value.displayOrder) || value.displayOrder < 0) {
      errors.push("displayOrder must be a non-negative integer");
    }
  } else if (isCreate) {
    value.displayOrder = 0;
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    value.isActive = parseOptionalBoolean(body.isActive);

    if (value.isActive === null) {
      errors.push("isActive must be a boolean");
    }
  } else if (isCreate) {
    value.isActive = true;
  }

  if (!isCreate && Object.keys(value).length === 0) {
    errors.push("At least one subscription plan field is required");
  }

  return { errors, value };
}

async function createPlan(req, res, next) {
  try {
    const { errors, value } = validateSubscriptionPlanPayload(req.body, {
      isCreate: true
    });

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const plan = await createSubscriptionPlan(value);

    return res.status(201).json({
      status: "success",
      message: "Subscription plan created successfully",
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
  createPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlans,
  updateSubscriptionPlan
};
