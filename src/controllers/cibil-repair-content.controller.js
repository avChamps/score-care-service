const {
  listActiveCibilRepairContent,
  listAllCibilRepairContent,
  replaceCibilRepairContent
} = require("../models/cibil-repair-content.model");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === null ? null : normalizeString(value) || null;
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

function normalizePlans(plans, errors) {
  if (!Array.isArray(plans)) {
    errors.push("plans must be an array");
    return [];
  }

  return plans.map((plan, index) => {
    const planName = normalizeString(plan.planName);
    const amount = Number(plan.amount);
    const currency = normalizeString(plan.currency || "INR").toUpperCase();
    const displayOrder =
      plan.displayOrder === undefined ? index + 1 : Number(plan.displayOrder);
    const isActive =
      plan.isActive === undefined ? true : parseOptionalBoolean(plan.isActive);

    if (!planName) {
      errors.push(`plans[${index}].planName is required`);
    }

    if (!Number.isFinite(amount) || amount < 0) {
      errors.push(`plans[${index}].amount must be a valid non-negative number`);
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push(`plans[${index}].currency must be a 3-letter currency code`);
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      errors.push(`plans[${index}].displayOrder must be a non-negative integer`);
    }

    if (isActive === null) {
      errors.push(`plans[${index}].isActive must be a boolean`);
    }

    return {
      publicId: normalizeString(plan.publicId || plan.id) || undefined,
      planName,
      amount,
      currency,
      billingCycle: normalizeNullableString(plan.billingCycle),
      buttonLabel: normalizeNullableString(plan.buttonLabel),
      displayOrder,
      isActive
    };
  });
}

function normalizeTimelines(timelines, errors) {
  if (!Array.isArray(timelines)) {
    errors.push("timelines must be an array");
    return [];
  }

  return timelines.map((timeline, index) => {
    const title = normalizeString(timeline.title);
    const description = normalizeString(timeline.description);
    const displayOrder =
      timeline.displayOrder === undefined
        ? index + 1
        : Number(timeline.displayOrder);
    const isActive =
      timeline.isActive === undefined
        ? true
        : parseOptionalBoolean(timeline.isActive);

    if (!title) {
      errors.push(`timelines[${index}].title is required`);
    }

    if (!description) {
      errors.push(`timelines[${index}].description is required`);
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      errors.push(
        `timelines[${index}].displayOrder must be a non-negative integer`
      );
    }

    if (isActive === null) {
      errors.push(`timelines[${index}].isActive must be a boolean`);
    }

    return {
      publicId: normalizeString(timeline.publicId || timeline.id) || undefined,
      title,
      description,
      displayOrder,
      isActive
    };
  });
}

function validateCibilRepairContentPayload(body) {
  const errors = [];

  return {
    errors,
    value: {
      plans: normalizePlans(body.plans, errors),
      timelines: normalizeTimelines(body.timelines, errors)
    }
  };
}

async function getCibilRepairContent(_req, res, next) {
  try {
    const content = await listActiveCibilRepairContent();

    return res.status(200).json({
      status: "success",
      data: content
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminCibilRepairContent(_req, res, next) {
  try {
    const content = await listAllCibilRepairContent();

    return res.status(200).json({
      status: "success",
      data: content
    });
  } catch (error) {
    next(error);
  }
}

async function saveAdminCibilRepairContent(req, res, next) {
  try {
    const { errors, value } = validateCibilRepairContentPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const content = await replaceCibilRepairContent(value);

    return res.status(200).json({
      status: "success",
      message: "CIBIL repair content updated successfully",
      data: content
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminCibilRepairContent,
  getCibilRepairContent,
  saveAdminCibilRepairContent
};
