const {
  listActiveCibilRepairContent,
  listAllCibilRepairContent,
  replaceCibilRepairContent
} = require("../models/cibil-repair-content.model");
const {
  createCibilRepairRequest,
  findCibilRepairRequestByPublicId,
  findLatestCibilRepairRequestByUserId,
  listCibilRepairRequests,
  updateCibilRepairRequest
} = require("../models/cibil-repair-request.model");

const paymentStatuses = new Set(["pending", "paid", "failed", "refunded"]);
const repairStatuses = new Set([
  "submitted",
  "analysis",
  "in_progress",
  "resolved",
  "closed",
  "cancelled"
]);

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

function toNonNegativeInteger(value, fieldName, errors) {
  const number = Number(value || 0);

  if (!Number.isInteger(number) || number < 0) {
    errors.push(`${fieldName} must be a non-negative integer`);
  }

  return number;
}

function validateCibilRepairRequestPayload(body) {
  const errors = [];
  const planName = normalizeString(body.planName);
  const amount = Number(body.amount);
  const currency = normalizeString(body.currency || "INR").toUpperCase();
  const paymentStatus = normalizeString(body.paymentStatus || "pending");
  const repairStatus = normalizeString(body.repairStatus || "submitted");

  if (!planName) {
    errors.push("planName is required");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("amount must be a valid positive number");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.push("currency must be a 3-letter currency code");
  }

  if (!paymentStatuses.has(paymentStatus)) {
    errors.push("Valid paymentStatus is required");
  }

  if (!repairStatuses.has(repairStatus)) {
    errors.push("Valid repairStatus is required");
  }

  return {
    errors,
    value: {
      planPublicId: normalizeNullableString(body.planPublicId || body.planId),
      planName,
      amount,
      currency,
      paymentStatus,
      repairStatus,
      remarks: normalizeNullableString(body.remarks)
    }
  };
}

function validateAdminCibilRepairRequestPayload(body) {
  const errors = [];
  const paymentStatus =
    body.paymentStatus === undefined ? undefined : normalizeString(body.paymentStatus);
  const repairStatus =
    body.repairStatus === undefined ? undefined : normalizeString(body.repairStatus);
  const progressItems = Array.isArray(body.progressItems)
    ? body.progressItems.map((item) => ({
        title: normalizeString(item.title),
        status: normalizeString(item.status),
        percent: toNonNegativeInteger(item.percent, "progressItems.percent", errors),
        remarks: normalizeNullableString(item.remarks)
      }))
    : [];

  const pointsGained =
    body.pointsGained === undefined ? undefined : Number(body.pointsGained);

  if (paymentStatus !== undefined && !paymentStatuses.has(paymentStatus)) {
    errors.push("Valid paymentStatus is required");
  }

  if (repairStatus !== undefined && !repairStatuses.has(repairStatus)) {
    errors.push("Valid repairStatus is required");
  }

  if (pointsGained !== undefined && !Number.isInteger(pointsGained)) {
    errors.push("pointsGained must be an integer");
  }

  return {
    errors,
    value: {
      paymentStatus,
      repairStatus,
      activeDisputes:
        body.activeDisputes === undefined
          ? undefined
          : toNonNegativeInteger(body.activeDisputes, "activeDisputes", errors),
      resolvedDisputes:
        body.resolvedDisputes === undefined
          ? undefined
          : toNonNegativeInteger(body.resolvedDisputes, "resolvedDisputes", errors),
      pointsGained,
      progressItems: body.progressItems === undefined ? undefined : progressItems,
      remarks: body.remarks === undefined ? undefined : normalizeNullableString(body.remarks)
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

async function createMyCibilRepairRequest(req, res, next) {
  try {
    const { errors, value } = validateCibilRepairRequestPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const request = await createCibilRepairRequest(
      req.auth.internalUserId,
      req.auth.userId,
      value
    );

    return res.status(201).json({
      status: "success",
      message: "CIBIL repair request saved successfully",
      data: {
        request
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyCibilRepairRequest(req, res, next) {
  try {
    const request = await findLatestCibilRepairRequestByUserId(req.auth.internalUserId);

    return res.status(200).json({
      status: "success",
      data: {
        request
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyCibilRepairStatus(req, res, next) {
  try {
    const request = await findLatestCibilRepairRequestByUserId(req.auth.internalUserId);

    return res.status(200).json({
      status: "success",
      data: {
        activeDisputes: request?.activeDisputes || 0,
        resolvedDisputes: request?.resolvedDisputes || 0,
        pointsGained: request?.pointsGained || 0,
        repairStatus: request?.repairStatus || null,
        remarks: request?.remarks || null
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminCibilRepairRequests(_req, res, next) {
  try {
    const requests = await listCibilRepairRequests();

    return res.status(200).json({
      status: "success",
      data: {
        requests
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminCibilRepairRequest(req, res, next) {
  try {
    const { errors, value } = validateAdminCibilRepairRequestPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const existingRequest = await findCibilRepairRequestByPublicId(req.params.publicId);

    if (!existingRequest) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    const request = await updateCibilRepairRequest(req.params.publicId, {
      paymentStatus: value.paymentStatus ?? existingRequest.paymentStatus,
      repairStatus: value.repairStatus ?? existingRequest.repairStatus,
      activeDisputes: value.activeDisputes ?? existingRequest.activeDisputes,
      resolvedDisputes: value.resolvedDisputes ?? existingRequest.resolvedDisputes,
      pointsGained: value.pointsGained ?? existingRequest.pointsGained,
      progressItems: value.progressItems ?? existingRequest.progressItems,
      remarks: value.remarks === undefined ? existingRequest.remarks : value.remarks
    });

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "CIBIL repair request updated successfully",
      data: {
        request
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMyCibilRepairRequest,
  getAdminCibilRepairContent,
  getAdminCibilRepairRequests,
  getCibilRepairContent,
  getMyCibilRepairRequest,
  getMyCibilRepairStatus,
  saveAdminCibilRepairContent,
  updateAdminCibilRepairRequest
};
