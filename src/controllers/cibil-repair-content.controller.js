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
  assignCibilRepairRequestEmployee,
  createCibilRepairRequestTimeline,
  createCibilRepairRequest,
  findAdminCibilRepairRequestDetail,
  findCibilRepairRequestByPublicId,
  findCibilRepairRequestByPublicIdAndUserId,
  findLatestCibilRepairRequestByUserId,
  listCibilRepairRequestTimelines,
  listCibilRepairRequestsByUserId,
  listCibilRepairRequests,
  updateCibilRepairRequestAccounts,
  updateCibilRepairRequest
} = require("../models/cibil-repair-request.model");
const {
  createCreditRepairDocument,
  listCreditRepairDocumentsByUserIdAndAccountNumbers
} = require("../models/credit-repair-document.model");
const {
  createDispute
} = require("../models/dispute.model");
const {
  createAdminCreditRepairNotification
} = require("../models/admin-notification.model");
const {
  countUnreadNotificationsByUserPublicId,
  createCibilRepairRequestCreatedNotification,
  createCibilRepairRequestUpdatedNotification,
  createCreditDisputeSubmittedNotification,
  listNotificationsByUserPublicId
} = require("../models/notification.model");
const {
  findEmployeeByPublicId,
  findEmployeeByPublicIdOrCode
} = require("../models/employee.model");
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
  sendManualUserWhatsapp,
  sendWhatsAppSafely
} = require("../services/whatsappNotification.service");
const {
  deleteSavedFiles,
  saveCreditRepairDocumentFile
} = require("../utils/upload-assets");

const paymentStatuses = new Set(["pending", "paid", "failed", "refunded"]);
const repairStatuses = new Set([
  "upload_document",
  "submitted",
  "under_review",
  "analysis",
  "in_progress",
  "resolved",
  "closed",
  "cancelled"
]);
const activeRepairStatuses = new Set([
  "upload_document",
  "submitted",
  "under_review",
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

function normalizeRepairAccounts(accounts, errors) {
  if (accounts === undefined) {
    return [];
  }

  if (!Array.isArray(accounts)) {
    errors.push("accounts must be an array");
    return [];
  }

  return accounts.map((account, index) => {
    const accountNumber = normalizeString(account.accountNumber);
    const accountType = normalizeString(account.accountType);

    if (!accountNumber) {
      errors.push(`accounts[${index}].accountNumber is required`);
    }

    if (!accountType) {
      errors.push(`accounts[${index}].accountType is required`);
    }

    return {
      accountNumber,
      accountType,
      subscriberName: normalizeNullableString(account.subscriberName),
      issueType: normalizeNullableString(account.issueType)
    };
  });
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
      remarks: "Please upload your docs",
      accounts: normalizeRepairAccounts(body.accounts, errors)
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

function formatFileSize(bytes) {
  if (!Number(bytes)) {
    return null;
  }

  const kb = Number(bytes) / 1024;

  return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
}

function getAccountKey(account) {
  return String(account?.id || account?.accountId || account?.accountNumber || "").trim();
}

function findRepairAccount(accounts, accountId) {
  const key = normalizeString(accountId);

  return (accounts || []).find((account, index) => (
    getAccountKey(account) === key || String(index + 1) === key
  ));
}

function mapAdminRepairDetail(request, documents, timeline) {
  return {
    publicId: request.publicId,
    userName: request.userName,
    mobileNumber: request.mobileNumber,
    email: request.email,
    planName: request.planName,
    amount: request.amount,
    currency: request.currency,
    paymentStatus: request.paymentStatus,
    repairStatus: request.repairStatus,
    bureau: request.bureau || request.accounts?.[0]?.bureau || request.accounts?.[0]?.bureauName || null,
    remarks: request.remarks,
    accounts: (request.accounts || []).map((account, index) => ({
      id: account.id || index + 1,
      subscriberName: account.subscriberName || account.bankName || account.lenderName || null,
      accountType: account.accountType || null,
      accountNumber: account.accountNumber || null,
      issueType: account.issueType || null,
      disputeStatus: account.disputeStatus || "not_filed"
    })),
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      documentUrl: document.documentUrl,
      fileSize: formatFileSize(document.fileSize),
      createdAt: document.createdAt
    })),
    timeline: timeline.length
      ? timeline
      : [{
          id: 0,
          title: "Case created",
          description: request.paymentStatus === "paid" ? "Payment confirmed" : "Request created",
          actorName: "System",
          createdAt: request.createdAt
        }],
    assignedEmployee: request.assignedEmployee,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}

async function getAdminActorName(req) {
  if (req.auth.tokenType === "employee_access" && req.auth.employeeId) {
    const employee = await findEmployeeByPublicId(req.auth.employeeId);

    return employee?.fullName || "Admin";
  }

  const user = req.auth.internalUserId ? await findUserById(req.auth.internalUserId) : null;

  return user?.fullName || "Admin";
}

function isFullAccessEmployee(employee) {
  const role = normalizeString(employee?.role || employee?.roleName).toLowerCase();

  return ["admin", "super_admin", "super admin", "administrator"].includes(role);
}

async function getAdminCibilRepairRequestScope(req) {
  if (req.auth.tokenType !== "employee_access") {
    return {};
  }

  const employee = await findEmployeeByPublicId(req.auth.employeeId);

  if (isFullAccessEmployee(employee)) {
    return {};
  }

  return {
    assignedEmployeeId: req.auth.internalEmployeeId
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
    const user = await findUserById(req.auth.internalUserId);
    await createAdminCreditRepairNotification(user, request);
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
    const requests = await listCibilRepairRequestsByUserId(req.auth.internalUserId);

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
        accounts: requests[0]?.accounts || []
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

async function getAdminCibilRepairRequests(req, res, next) {
  try {
    const scope = await getAdminCibilRepairRequestScope(req);
    const data = await listCibilRepairRequests({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      repairStatus: req.query.repairStatus || req.query.status,
      paymentStatus: req.query.paymentStatus,
      from: req.query.from,
      totime: req.query.totime,
      assignedEmployeeId: scope.assignedEmployeeId
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminCibilRepairRequestDetail(req, res, next) {
  try {
    const scope = await getAdminCibilRepairRequestScope(req);
    const request = await findAdminCibilRepairRequestDetail(
      req.params.publicId,
      scope
    );

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    const [documents, timeline] = await Promise.all([
      listCreditRepairDocumentsByUserIdAndAccountNumbers(
        request.internalUserId,
        request.accounts.map((account) => account.accountNumber)
      ),
      listCibilRepairRequestTimelines(req.params.publicId)
    ]);

    return res.status(200).json({
      status: "success",
      data: mapAdminRepairDetail(request, documents, timeline)
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

    const scope = await getAdminCibilRepairRequestScope(req);
    const existingRequest = await findAdminCibilRepairRequestDetail(
      req.params.publicId,
      scope
    );

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
    const actorName = await getAdminActorName(req);
    await createCibilRepairRequestTimeline(req.params.publicId, {
      title: "Case updated",
      description: value.remarks || `Status updated to ${request.repairStatus}`,
      actorName
    });
    const notification = await createCibilRepairRequestUpdatedNotification(
      user.internalId,
      request
    );
    const appNotificationPush = await sendStoredNotificationToUser(user.internalId, notification);
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
        publicId: request.publicId,
        repairStatus: request.repairStatus,
        remarks: request.remarks,
        updatedAt: request.updatedAt,
        appNotificationPush
      }
    });
  } catch (error) {
    next(error);
  }
}

async function assignAdminCibilRepairRequestEmployee(req, res, next) {
  try {
    const scope = await getAdminCibilRepairRequestScope(req);

    if (scope.assignedEmployeeId) {
      return res.status(403).json({
        status: "error",
        message: "Only admin can assign credit repair cases"
      });
    }

    const employeePublicId = normalizeString(req.body.employeePublicId);

    if (!employeePublicId) {
      return res.status(400).json({
        status: "error",
        errors: ["employeePublicId is required"]
      });
    }

    const [existingRequest, employee] = await Promise.all([
      findAdminCibilRepairRequestDetail(req.params.publicId),
      findEmployeeByPublicIdOrCode(employeePublicId)
    ]);

    if (!existingRequest) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    if (!employee || employee.status !== "active" || employee.deletedAt) {
      return res.status(404).json({
        status: "error",
        message: "Employee not found"
      });
    }

    const request = await assignCibilRepairRequestEmployee(
      req.params.publicId,
      employee.internalId
    );
    const actorName = await getAdminActorName(req);
    await createCibilRepairRequestTimeline(req.params.publicId, {
      title: "Employee assigned",
      description: `${employee.fullName} assigned to this case`,
      actorName
    });

    if (parseOptionalBoolean(req.body.notifyUser)) {
      const user = await findUserByPublicId(request.userPublicId);
      const notification = await createCibilRepairRequestUpdatedNotification(
        user.internalId,
        request
      );
      await sendStoredNotificationToUser(user.internalId, notification);
    }

    return res.status(200).json({
      status: "success",
      message: "Employee assigned successfully",
      data: {
        publicId: request.publicId,
        assignedEmployee: request.assignedEmployee
      }
    });
  } catch (error) {
    next(error);
  }
}

async function uploadAdminCibilRepairRequestDocument(req, res, next) {
  let savedFile = null;

  try {
    const scope = await getAdminCibilRepairRequestScope(req);
    const request = await findAdminCibilRepairRequestDetail(
      req.params.publicId,
      scope
    );

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    const documentType = normalizeString(req.body.documentType || "additional_document");
    const accountNumber = normalizeString(req.body.accountNumber);
    const account = (request.accounts || []).find((item) => (
      normalizeString(item.accountNumber) === accountNumber
    ));
    const errors = [];

    if (!documentType) {
      errors.push("documentType is required");
    }

    if (!accountNumber) {
      errors.push("accountNumber is required");
    }

    if (!req.file) {
      errors.push("document is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    savedFile = await saveCreditRepairDocumentFile(request.userPublicId, req.file);
    const document = await createCreditRepairDocument(request.internalUserId, {
      creditReportId: normalizeNullableString(req.body.creditReportId),
      accountNumber,
      accountType: normalizeString(req.body.accountType || account?.accountType || "additional_document"),
      bankName: normalizeNullableString(req.body.bankName || account?.subscriberName || account?.bankName),
      issueType: normalizeNullableString(req.body.issueType || account?.issueType),
      documentType,
      documentUrl: savedFile.url,
      fileSize: req.file.size,
      closingDate: normalizeNullableString(req.body.closingDate),
      remarks: normalizeNullableString(req.body.remarks)
    });
    const actorName = await getAdminActorName(req);
    await createCibilRepairRequestTimeline(req.params.publicId, {
      title: "Document uploaded",
      description: `${documentType} uploaded`,
      actorName
    });

    return res.status(201).json({
      status: "success",
      message: "Document uploaded successfully",
      data: {
        id: document.id,
        documentType: document.documentType,
        documentUrl: document.documentUrl,
        createdAt: document.createdAt
      }
    });
  } catch (error) {
    if (savedFile) {
      await deleteSavedFiles({ document: [savedFile] }).catch(() => null);
    }

    next(error);
  }
}

async function fileAdminCibilRepairAccountDispute(req, res, next) {
  try {
    const scope = await getAdminCibilRepairRequestScope(req);
    const request = await findAdminCibilRepairRequestDetail(
      req.params.publicId,
      scope
    );

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    const account = findRepairAccount(request.accounts, req.params.accountId);

    if (!account) {
      return res.status(404).json({
        status: "error",
        message: "Repair account not found"
      });
    }

    const remarks = normalizeNullableString(req.body.remarks);
    const dispute = await createDispute(
      request.internalUserId,
      request.userPublicId,
      {
        accountData: account,
        lenderName: account.subscriberName || account.bankName || account.lenderName,
        accountNumber: account.accountNumber,
        errorType: account.issueType || "credit_repair_dispute",
        bureaus: [request.bureau || account.bureau || account.bureauName || "CIBIL"],
        additionalDetails: remarks,
        documents: {}
      }
    );
    const updatedAccounts = request.accounts.map((item, index) => (
      item === account || getAccountKey(item) === getAccountKey(account) || String(index + 1) === normalizeString(req.params.accountId)
        ? { ...item, disputeStatus: "submitted", disputePublicId: dispute.publicId }
        : item
    ));

    await updateCibilRepairRequestAccounts(req.params.publicId, updatedAccounts);
    const actorName = await getAdminActorName(req);
    await createCibilRepairRequestTimeline(req.params.publicId, {
      title: "Dispute filed",
      description: remarks || `Dispute filed for account ${account.accountNumber || req.params.accountId}`,
      actorName
    });

    if (parseOptionalBoolean(req.body.notifyUser)) {
      const notification = await createCreditDisputeSubmittedNotification(
        request.internalUserId,
        dispute
      );
      await sendStoredNotificationToUser(request.internalUserId, notification);
    }

    return res.status(201).json({
      status: "success",
      message: "Dispute filed successfully",
      data: {
        disputePublicId: dispute.publicId,
        disputeStatus: dispute.status
      }
    });
  } catch (error) {
    next(error);
  }
}

async function sendAdminCibilRepairWhatsapp(req, res, next) {
  try {
    const message = normalizeString(req.body.message);

    if (!message) {
      return res.status(400).json({
        status: "error",
        errors: ["message is required"]
      });
    }

    const scope = await getAdminCibilRepairRequestScope(req);
    const request = await findAdminCibilRepairRequestDetail(
      req.params.publicId,
      scope
    );

    if (!request) {
      return res.status(404).json({
        status: "error",
        message: "CIBIL repair request not found"
      });
    }

    const user = await findUserByPublicId(request.userPublicId);
    await sendWhatsAppSafely(() => sendManualUserWhatsapp(user, message));
    const actorName = await getAdminActorName(req);
    await createCibilRepairRequestTimeline(req.params.publicId, {
      title: "WhatsApp sent",
      description: message,
      actorName
    });

    return res.status(200).json({
      status: "success",
      message: "WhatsApp notification sent successfully"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  assignAdminCibilRepairRequestEmployee,
  createAdminCibilRepairTimeline,
  createMyCibilRepairPaymentOrder,
  createMyCibilRepairRequest,
  deleteAdminCibilRepairTimeline,
  fileAdminCibilRepairAccountDispute,
  getAdminCibilRepairContent,
  getAdminCibilRepairRequestDetail,
  getAdminCibilRepairRequests,
  getCibilRepairContent,
  getMyCibilRepairRequest,
  getMyCibilRepairRequestById,
  getMyCibilRepairStatus,
  saveAdminCibilRepairContent,
  sendAdminCibilRepairWhatsapp,
  uploadAdminCibilRepairRequestDocument,
  updateAdminCibilRepairTimeline,
  updateAdminCibilRepairRequest
};
