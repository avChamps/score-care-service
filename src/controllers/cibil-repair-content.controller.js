const {
  createCibilRepairTimeline,
  deleteCibilRepairTimeline,
  listActiveCibilRepairContent,
  listAllCibilRepairContent,
  patchCibilRepairContent,
  replaceCibilRepairContent,
  updateCibilRepairTimeline
} = require("../models/cibil-repair-content.model");
const {
  createCibilRepairRequest,
  findCibilRepairRequestByPublicId,
  findCibilRepairRequestByPublicIdAndUserId,
  findLatestCibilRepairRequestByUserId,
  listCibilRepairRequestsByUserId,
  listCibilRepairRequests,
  updateCibilRepairRequest
} = require("../models/cibil-repair-request.model");
const {
  listCreditRepairDocumentsByUserId
} = require("../models/credit-repair-document.model");
const {
  countUnreadNotificationsByUserPublicId,
  createCibilRepairRequestCreatedNotification,
  createCibilRepairRequestUpdatedNotification,
  listNotificationsByUserPublicId
} = require("../models/notification.model");
const { findUserById, findUserByPublicId } = require("../models/user.model");
const {
  createRazorpayOrder,
  getRazorpayCredentials,
  normalizeRazorpayPrefill,
  verifyRazorpayPaymentSignature
} = require("../services/razorpay.service");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");
const {
  sendCreditImprovedWhatsapp,
  sendDisputeStatusWhatsapp,
  sendWhatsAppSafely
} = require("../services/whatsappNotification.service");

const paymentStatuses = new Set(["pending", "paid", "failed", "refunded"]);
const repairStatuses = new Set([
  "upload_document",
  "submitted",
  "analysis",
  "in_progress",
  "resolved",
  "closed",
  "cancelled"
]);
const activeRepairStatuses = new Set([
  "upload_document",
  "submitted",
  "analysis",
  "in_progress"
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
    const gstPercentage =
      plan.gstPercentage === undefined ? 0 : Number(plan.gstPercentage);
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

    if (!Number.isFinite(gstPercentage) || gstPercentage < 0) {
      errors.push(`plans[${index}].gstPercentage must be a valid non-negative number`);
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
      gstPercentage,
      offerTag: normalizeNullableString(plan.offerTag),
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

function normalizePartialPlans(body, errors) {
  const plans = Array.isArray(body.plans)
    ? body.plans
    : body.plan
      ? [body.plan]
      : body.planName || body.amount !== undefined
        ? [body]
        : [];

  return plans.map((plan, index) => {
    const value = {
      publicId: normalizeString(plan.publicId || plan.id) || undefined,
      currentPlanName: normalizeString(plan.currentPlanName) || undefined,
      currentDisplayOrder:
        plan.currentDisplayOrder === undefined
          ? undefined
          : Number(plan.currentDisplayOrder),
      planName: normalizeString(plan.planName) || undefined
    };

    if (
      !value.publicId &&
      !value.currentPlanName &&
      !Number.isInteger(value.currentDisplayOrder) &&
      !value.planName
    ) {
      errors.push(
        `plans[${index}].publicId, plans[${index}].currentPlanName, or plans[${index}].planName is required`
      );
    }

    if (
      plan.currentDisplayOrder !== undefined &&
      (!Number.isInteger(value.currentDisplayOrder) || value.currentDisplayOrder < 0)
    ) {
      errors.push(`plans[${index}].currentDisplayOrder must be a non-negative integer`);
    }

    if (Object.prototype.hasOwnProperty.call(plan, "planName") && !value.planName) {
      errors.push(`plans[${index}].planName is required`);
    }

    if (Object.prototype.hasOwnProperty.call(plan, "amount")) {
      value.amount = Number(plan.amount);

      if (!Number.isFinite(value.amount) || value.amount < 0) {
        errors.push(`plans[${index}].amount must be a valid non-negative number`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(plan, "currency")) {
      value.currency = normalizeString(plan.currency).toUpperCase();

      if (!/^[A-Z]{3}$/.test(value.currency)) {
        errors.push(`plans[${index}].currency must be a 3-letter currency code`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(plan, "gstPercentage")) {
      value.gstPercentage = Number(plan.gstPercentage);

      if (!Number.isFinite(value.gstPercentage) || value.gstPercentage < 0) {
        errors.push(`plans[${index}].gstPercentage must be a valid non-negative number`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(plan, "offerTag")) {
      value.offerTag = normalizeNullableString(plan.offerTag);
    }

    if (Object.prototype.hasOwnProperty.call(plan, "buttonLabel")) {
      value.buttonLabel = normalizeNullableString(plan.buttonLabel);
    }

    if (Object.prototype.hasOwnProperty.call(plan, "displayOrder")) {
      value.displayOrder = Number(plan.displayOrder);

      if (!Number.isInteger(value.displayOrder) || value.displayOrder < 0) {
        errors.push(`plans[${index}].displayOrder must be a non-negative integer`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(plan, "isActive")) {
      value.isActive = parseOptionalBoolean(plan.isActive);

      if (value.isActive === null) {
        errors.push(`plans[${index}].isActive must be a boolean`);
      }
    }

    return value;
  });
}

function normalizePartialTimelines(body, errors) {
  const timelines = Array.isArray(body.timelines)
    ? body.timelines
    : body.timeline
      ? [body.timeline]
      : body.title || body.description
        ? [body]
        : [];

  return timelines.map((timeline, index) => {
    const value = {
      publicId: normalizeString(timeline.publicId || timeline.id) || undefined,
      currentDisplayOrder:
        timeline.currentDisplayOrder === undefined
          ? Number(timeline.displayOrder)
          : Number(timeline.currentDisplayOrder)
    };

    if (!value.publicId && !Number.isInteger(value.currentDisplayOrder)) {
      errors.push(
        `timelines[${index}].publicId or timelines[${index}].displayOrder is required`
      );
    }

    if (Object.prototype.hasOwnProperty.call(timeline, "title")) {
      value.title = normalizeString(timeline.title);

      if (!value.title) {
        errors.push(`timelines[${index}].title is required`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(timeline, "description")) {
      value.description = normalizeString(timeline.description);

      if (!value.description) {
        errors.push(`timelines[${index}].description is required`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(timeline, "displayOrder")) {
      value.displayOrder = Number(timeline.displayOrder);

      if (!Number.isInteger(value.displayOrder) || value.displayOrder < 0) {
        errors.push(
          `timelines[${index}].displayOrder must be a non-negative integer`
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(timeline, "isActive")) {
      value.isActive = parseOptionalBoolean(timeline.isActive);

      if (value.isActive === null) {
        errors.push(`timelines[${index}].isActive must be a boolean`);
      }
    }

    return value;
  });
}

function validateCibilRepairContentPatchPayload(body) {
  const errors = [];

  return {
    errors,
    value: {
      plans: normalizePartialPlans(body, errors),
      timelines: normalizePartialTimelines(body, errors)
    }
  };
}

function validateTimelinePayload(body) {
  const errors = [];
  const [timeline] = normalizeTimelines([body], errors);

  return {
    errors,
    value: timeline
  };
}

function validateTimelinePatchPayload(body) {
  const errors = [];
  const [timeline] = normalizePartialTimelines({ timelines: [body] }, errors);

  return {
    errors,
    value: timeline
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
  const repairStatus = "upload_document";
  const razorpayOrderId = normalizeString(body.razorpayOrderId);
  const razorpayPaymentId = normalizeString(body.razorpayPaymentId);
  const razorpaySignature = normalizeString(body.razorpaySignature);

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

  if (!razorpayOrderId) {
    errors.push("razorpayOrderId is required");
  }

  if (!razorpayPaymentId) {
    errors.push("razorpayPaymentId is required");
  }

  if (!razorpaySignature) {
    errors.push("razorpaySignature is required");
  }

  return {
    errors,
    value: {
      planPublicId: normalizeNullableString(body.planPublicId || body.planId),
      planName,
      amount,
      currency,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      repairStatus,
      remarks: "Please upload your docs"
    }
  };
}

function validateCibilRepairPaymentOrderPayload(body) {
  const errors = [];
  const planName = normalizeString(body.planName);
  const amount = Number(body.amount);
  const currency = normalizeString(body.currency || "INR").toUpperCase();

  if (!planName) {
    errors.push("planName is required");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("amount must be a valid positive number");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.push("currency must be a 3-letter currency code");
  }

  return {
    errors,
    value: {
      planPublicId: normalizeNullableString(body.planPublicId || body.planId),
      planName,
      amount,
      currency
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
    const { errors, value } = req.method === "PATCH"
      ? validateCibilRepairContentPatchPayload(req.body)
      : validateCibilRepairContentPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const content = req.method === "PATCH"
      ? await patchCibilRepairContent(value)
      : await replaceCibilRepairContent(value);

    return res.status(200).json({
      status: "success",
      message: "CIBIL repair content updated successfully",
      data: content
    });
  } catch (error) {
    next(error);
  }
}

async function createAdminCibilRepairTimeline(req, res, next) {
  try {
    const { errors, value } = validateTimelinePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const content = await createCibilRepairTimeline(value);

    return res.status(201).json({
      status: "success",
      message: "CIBIL repair timeline created successfully",
      data: content
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminCibilRepairTimeline(req, res, next) {
  try {
    const publicId = normalizeString(req.params.publicId);
    const { errors, value } = validateTimelinePatchPayload(req.body);

    if (!publicId) {
      errors.push("publicId is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const content = await updateCibilRepairTimeline(publicId, value);

    if (!content) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair timeline not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "CIBIL repair timeline updated successfully",
      data: content
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAdminCibilRepairTimeline(req, res, next) {
  try {
    const publicId = normalizeString(req.params.publicId);

    if (!publicId) {
      return res.status(400).json({
        status: "error",
        errors: ["publicId is required"]
      });
    }

    const content = await deleteCibilRepairTimeline(publicId);

    if (!content) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair timeline not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "CIBIL repair timeline deleted successfully",
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

    const isVerified = verifyRazorpayPaymentSignature(value);

    if (!isVerified) {
      return res.status(400).json({
        status: "error",
        message: "Invalid Razorpay payment signature"
      });
    }

    const request = await createCibilRepairRequest(
      req.auth.internalUserId,
      req.auth.userId,
      {
        ...value,
        paymentStatus: "paid"
      }
    );
    const notification = await createCibilRepairRequestCreatedNotification(
      req.auth.internalUserId,
      request
    );
    await sendStoredNotificationToUser(req.auth.internalUserId, notification);
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsByUserPublicId(req.auth.userId),
      countUnreadNotificationsByUserPublicId(req.auth.userId)
    ]);

    return res.status(201).json({
      status: "success",
      message: "CIBIL repair request saved successfully",
      data: {
        request,
        notification,
        unreadCount,
        notifications
      }
    });
  } catch (error) {
    next(error);
  }
}

async function createMyCibilRepairPaymentOrder(req, res, next) {
  try {
    const { errors, value } = validateCibilRepairPaymentOrderPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const user = await findUserById(req.auth.internalUserId);
    const prefill = normalizeRazorpayPrefill(user);
    const order = await createRazorpayOrder({
      amount: value.amount,
      currency: value.currency,
      receipt: `repair_${req.auth.internalUserId}_${Date.now()}`,
      notes: {
        userId: req.auth.userId,
        planPublicId: value.planPublicId || "",
        planName: value.planName
      }
    });

    return res.status(201).json({
      status: "success",
      data: {
        keyId: getRazorpayCredentials().keyId,
        prefill,
        order
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyCibilRepairRequest(req, res, next) {
  try {
    const [requests, documents] = await Promise.all([
      listCibilRepairRequestsByUserId(req.auth.internalUserId),
      listCreditRepairDocumentsByUserId(req.auth.internalUserId)
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        activeDisputes: requests.filter(
          (request) => activeRepairStatuses.has(request.repairStatus)
        ).length,
        resolvedDisputes: requests.filter(
          (request) => request.repairStatus === "resolved"
        ).length,
        requests,
        accounts: documents.map((document) => ({
          accountNumber: document.accountNumber,
          accountType: document.accountType,
          subscriberName: document.bankName,
          issueType: document.issueType
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyCibilRepairRequestById(req, res, next) {
  try {
    const request = await findCibilRepairRequestByPublicIdAndUserId(
      req.params.publicId,
      req.auth.internalUserId
    );

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

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
    const request = req.params.publicId
      ? await findCibilRepairRequestByPublicIdAndUserId(
          req.params.publicId,
          req.auth.internalUserId
        )
      : await findLatestCibilRepairRequestByUserId(req.auth.internalUserId);

    if (req.params.publicId && !request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        repairId: request?.publicId || null,
        activeDisputes: request?.activeDisputes || 0,
        resolvedDisputes: request?.resolvedDisputes || 0,
        pointsGained: request?.pointsGained || 0,
        repairStatus: request?.repairStatus || null,
        progressItems: request?.progressItems || [],
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

    const user = await findUserByPublicId(request.userPublicId);
    const notification = await createCibilRepairRequestUpdatedNotification(
      user.internalId,
      request
    );
    await sendStoredNotificationToUser(user.internalId, notification);
    const disputeWhatsapp = await sendWhatsAppSafely(() => sendDisputeStatusWhatsapp(
      user,
      request
    ));
    const creditImprovedWhatsapp = Number(request.pointsGained) > Number(existingRequest.pointsGained)
      ? await sendWhatsAppSafely(() => sendCreditImprovedWhatsapp(user, request))
      : { status: "skipped", reason: "Credit points not increased" };

    return res.status(200).json({
      status: "success",
      message: "CIBIL repair request updated successfully",
      data: {
        request,
        notification,
        disputeWhatsapp,
        creditImprovedWhatsapp
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAdminCibilRepairTimeline,
  createMyCibilRepairPaymentOrder,
  createMyCibilRepairRequest,
  deleteAdminCibilRepairTimeline,
  getAdminCibilRepairContent,
  getAdminCibilRepairRequests,
  getCibilRepairContent,
  getMyCibilRepairRequest,
  getMyCibilRepairRequestById,
  getMyCibilRepairStatus,
  saveAdminCibilRepairContent,
  updateAdminCibilRepairTimeline,
  updateAdminCibilRepairRequest
};
