const {
  createReward,
  deleteReward,
  listMyRedemptions,
  listRewards,
  redeemReward,
  updateReward
} = require("../models/reward.model");

const rewardTypes = new Set([
  "subscription_discount",
  "credit_repair_discount",
  "cashback",
  "partner_offer"
]);
const valueTypes = new Set(["flat", "percentage"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === null ? null : normalizeString(value) || null;
}

function parseOptionalBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
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

function validateRewardPayload(body, { isCreate = false } = {}) {
  const errors = [];
  const value = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    value.title = normalizeString(body.title);

    if (!value.title) {
      errors.push("title is required");
    }
  } else if (isCreate) {
    errors.push("title is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    value.description = normalizeNullableString(body.description);
  }

  if (Object.prototype.hasOwnProperty.call(body, "type")) {
    value.type = normalizeString(body.type);

    if (!rewardTypes.has(value.type)) {
      errors.push("type is invalid");
    }
  } else if (isCreate) {
    errors.push("type is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "value")) {
    value.value = Number(body.value);

    if (!Number.isFinite(value.value) || value.value < 0) {
      errors.push("value must be a non-negative number");
    }
  } else if (isCreate) {
    value.value = 0;
  }

  if (Object.prototype.hasOwnProperty.call(body, "valueType")) {
    value.valueType = normalizeString(body.valueType);

    if (!valueTypes.has(value.valueType)) {
      errors.push("valueType is invalid");
    }
  } else if (isCreate) {
    value.valueType = "flat";
  }

  if (Object.prototype.hasOwnProperty.call(body, "terms")) {
    value.terms = normalizeNullableString(body.terms);
  }

  if (Object.prototype.hasOwnProperty.call(body, "coinCost")) {
    value.coinCost = Number.parseInt(body.coinCost, 10);

    if (!Number.isInteger(value.coinCost) || value.coinCost <= 0) {
      errors.push("coinCost must be a positive integer");
    }
  } else if (isCreate) {
    errors.push("coinCost is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "maxRedemptionsPerUser")) {
    value.maxRedemptionsPerUser =
      body.maxRedemptionsPerUser === null
        ? null
        : Number.parseInt(body.maxRedemptionsPerUser, 10);

    if (
      value.maxRedemptionsPerUser !== null &&
      (!Number.isInteger(value.maxRedemptionsPerUser) ||
        value.maxRedemptionsPerUser <= 0)
    ) {
      errors.push("maxRedemptionsPerUser must be a positive integer or null");
    }
  } else if (isCreate) {
    value.maxRedemptionsPerUser = null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "validFrom")) {
    value.validFrom = normalizeNullableString(body.validFrom);
  }

  if (Object.prototype.hasOwnProperty.call(body, "validTo")) {
    value.validTo = normalizeNullableString(body.validTo);
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive") || isCreate) {
    value.isActive = parseOptionalBoolean(body.isActive, true);

    if (value.isActive === null) {
      errors.push("isActive must be boolean");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "ruleIsActive") || isCreate) {
    value.ruleIsActive = parseOptionalBoolean(body.ruleIsActive, true);

    if (value.ruleIsActive === null) {
      errors.push("ruleIsActive must be boolean");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayOrder")) {
    value.displayOrder = Number.parseInt(body.displayOrder, 10);

    if (!Number.isInteger(value.displayOrder)) {
      errors.push("displayOrder must be an integer");
    }
  } else if (isCreate) {
    value.displayOrder = 0;
  }

  return {
    errors,
    value
  };
}

async function getRewards(_req, res, next) {
  try {
    const rewards = await listRewards({ activeOnly: true });

    return res.status(200).json({
      status: "success",
      data: {
        rewards
      }
    });
  } catch (error) {
    next(error);
  }
}

async function redeemMyReward(req, res, next) {
  try {
    const result = await redeemReward({
      userId: req.auth.internalUserId,
      rewardPublicId: req.params.publicId,
      applyTo: normalizeNullableString(req.body.applyTo),
      targetPublicId: normalizeNullableString(req.body.targetPublicId),
      metadata: req.body.metadata && typeof req.body.metadata === "object"
        ? req.body.metadata
        : null
    });

    if (result.error) {
      return res.status(400).json({
        status: "error",
        message: result.error
      });
    }

    return res.status(201).json({
      status: "success",
      message: "Reward redeemed successfully",
      data: {
        redemption: result.redemption
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyRedemptions(req, res, next) {
  try {
    const data = await listMyRedemptions({
      userId: req.auth.internalUserId,
      page: req.query.page,
      limit: req.query.limit
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminRewards(_req, res, next) {
  try {
    const rewards = await listRewards({ activeOnly: false });

    return res.status(200).json({
      status: "success",
      data: {
        rewards
      }
    });
  } catch (error) {
    next(error);
  }
}

async function createAdminReward(req, res, next) {
  try {
    const { errors, value } = validateRewardPayload(req.body, { isCreate: true });

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const reward = await createReward(value);

    return res.status(201).json({
      status: "success",
      message: "Reward created successfully",
      data: {
        reward
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminReward(req, res, next) {
  try {
    const { errors, value } = validateRewardPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const reward = await updateReward(req.params.publicId, value);

    if (!reward) {
      return res.status(404).json({
        status: "error",
        message: "Reward not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Reward updated successfully",
      data: {
        reward
      }
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAdminReward(req, res, next) {
  try {
    const deleted = await deleteReward(req.params.publicId);

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Reward not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Reward disabled successfully"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAdminReward,
  deleteAdminReward,
  getAdminRewards,
  getMyRedemptions,
  getRewards,
  redeemMyReward,
  updateAdminReward
};
