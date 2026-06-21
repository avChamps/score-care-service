const {
  createDispute,
  findDisputeByPublicId,
  getDisputeSummaryByUserId,
  listDisputes,
  listDisputesByUserId,
  updateDisputeByPublicId
} = require("../models/dispute.model");
const {
  createAdminDisputeRaisedNotification
} = require("../models/admin-notification.model");
const {
  createCreditDisputeSubmittedNotification,
  createCreditDisputeStatusUpdatedNotification
} = require("../models/notification.model");
const { findUserById, findUserByPublicId } = require("../models/user.model");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");
const {
  deleteSavedFiles,
  deleteDisputeUploadedFiles,
  mapDisputeDocuments,
  saveDisputeUploadedFiles
} = require("../utils/upload-assets");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === undefined || value === null ? null : normalizeString(value) || null;
}

function parseJsonField(value, fieldName, errors) {
  if (!value) {
    errors.push(`${fieldName} is required`);
    return null;
  }

  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (_error) {
    errors.push(`${fieldName} must be valid JSON`);
    return null;
  }
}

function getAccountValue(accountData, keys) {
  for (const key of keys) {
    const value = accountData?.[key];

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

function validateDisputePayload(req) {
  const { body, files } = req;
  const errors = [];
  const accountData = parseJsonField(body.accountData, "accountData", errors);
  const bureaus = parseJsonField(body.bureaus, "bureaus", errors);
  const errorType = normalizeString(body.errorType);

  if (!errorType) {
    errors.push("errorType is required");
  }

  if (!Array.isArray(bureaus) || bureaus.length === 0) {
    errors.push("bureaus must have at least one item");
  }

  if (
    errorType === "Account showing active after closure" &&
    !files?.closureCertificate?.length
  ) {
    errors.push("closureCertificate is required");
  }

  return {
    errors,
    value: {
      accountData,
      lenderName: getAccountValue(accountData, [
        "lenderName",
        "bankName",
        "institutionName",
        "subscriberName",
        "creditorName"
      ]),
      accountNumber: getAccountValue(accountData, [
        "accountNumber",
        "accountNo",
        "acctNumber",
        "memberReferenceNumber"
      ]),
      errorType,
      bureaus: Array.isArray(bureaus) ? bureaus : [],
      additionalDetails: normalizeNullableString(body.additionalDetails)
    }
  };
}

async function submitDispute(req, res, next) {
  let documents = {};
  let savedFiles = [];

  try {
    const { errors, value } = validateDisputePayload(req);

    if (!req.auth?.userId) {
      errors.push("userPublicId is required");
    }

    if (errors.length > 0) {
      await deleteDisputeUploadedFiles(req.files);
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    savedFiles = await saveDisputeUploadedFiles(req.auth.userId, req.files);
    documents = mapDisputeDocuments(savedFiles);

    const dispute = await createDispute(
      req.auth.internalUserId,
      req.auth.userId,
      {
        ...value,
        documents
      }
    );
    const notification = await createCreditDisputeSubmittedNotification(
      req.auth.internalUserId,
      dispute
    );
    const user = await findUserById(req.auth.internalUserId);
    await createAdminDisputeRaisedNotification(user, dispute);
    await sendStoredNotificationToUser(req.auth.internalUserId, notification);

    return res.status(201).json({
      status: "success",
      message: "Dispute submitted successfully",
      data: {
        publicId: dispute.publicId,
        status: dispute.status,
        documents: dispute.documents,
        notification
      }
    });
  } catch (error) {
    await deleteSavedFiles({ disputeDocuments: savedFiles });
    next(error);
  }
}

async function getMyDisputes(req, res, next) {
  try {
    const [summary, disputes] = await Promise.all([
      getDisputeSummaryByUserId(req.auth.internalUserId),
      listDisputesByUserId(req.auth.internalUserId)
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        ...summary,
        disputes
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminDisputes(_req, res, next) {
  try {
    const disputes = await listDisputes();

    return res.status(200).json({
      status: "success",
      data: {
        disputes
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminDispute(req, res, next) {
  try {
    const allowedStatuses = new Set([
      "submitted",
      "under_review",
      "resolved",
      "rejected"
    ]);
    const status = req.body.status === undefined
      ? undefined
      : normalizeString(req.body.status);
    const remarks = req.body.remarks === undefined
      ? undefined
      : normalizeNullableString(req.body.remarks);
    const errors = [];

    if (status !== undefined && !allowedStatuses.has(status)) {
      errors.push("Valid status is required");
    }

    if (status === undefined && remarks === undefined) {
      errors.push("status or remarks is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const existingDispute = await findDisputeByPublicId(req.params.publicId);

    if (!existingDispute) {
      return res.status(404).json({
        status: "error",
        message: "Dispute not found"
      });
    }

    const dispute = await updateDisputeByPublicId(req.params.publicId, {
      status,
      remarks
    });
    const user = await findUserByPublicId(dispute.userPublicId);
    const notification = await createCreditDisputeStatusUpdatedNotification(
      user.internalId,
      dispute
    );
    await sendStoredNotificationToUser(user.internalId, notification);

    return res.status(200).json({
      status: "success",
      message: "Dispute updated successfully",
      data: {
        dispute,
        notification
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminDisputes,
  getMyDisputes,
  submitDispute,
  updateAdminDispute
};
