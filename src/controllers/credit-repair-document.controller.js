const {
  createCreditRepairDocument,
  listCreditRepairDocumentsByUserId
} = require("../models/credit-repair-document.model");
const {
  findLatestCibilRepairRequestByUserId,
  updateCibilRepairRequest
} = require("../models/cibil-repair-request.model");
const {
  createCreditRepairDocumentsUploadedNotification
} = require("../models/notification.model");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");
const {
  deleteSavedFiles,
  saveCreditRepairDocumentFile
} = require("../utils/upload-assets");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);

  return normalized || null;
}

function validateCreditRepairDocumentPayload(req) {
  const errors = [];
  const accountNumber = normalizeString(
    req.body.accountNumber || req.body.creditCardNumber || req.body.loanNumber
  );
  const accountType = normalizeString(req.body.accountType);
  const documentType = normalizeString(req.body.documentType || "document");

  if (!accountNumber) {
    errors.push("accountNumber is required");
  }

  if (!accountType) {
    errors.push("accountType is required");
  }

  if (!req.file) {
    errors.push("file is required");
  }

  return {
    errors,
    value: {
      creditReportId: normalizeNullableString(req.body.creditReportId),
      accountNumber,
      accountType,
      bankName: normalizeNullableString(req.body.bankName),
      issueType: normalizeNullableString(req.body.issueType),
      documentType,
      closingDate: normalizeNullableString(req.body.closingDate),
      remarks: normalizeNullableString(req.body.remarks)
    }
  };
}

async function uploadCreditRepairDocument(req, res, next) {
  let savedFile = null;

  try {
    const { errors, value } = validateCreditRepairDocumentPayload(req);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    savedFile = await saveCreditRepairDocumentFile(req.auth.userId, req.file);

    const document = await createCreditRepairDocument(req.auth.internalUserId, {
      ...value,
      documentUrl: savedFile.url,
      fileSize: req.file.size
    });
    const existingRequest = await findLatestCibilRepairRequestByUserId(
      req.auth.internalUserId
    );
    const request = existingRequest?.repairStatus === "upload_document"
      ? await updateCibilRepairRequest(existingRequest.id, {
          paymentStatus: existingRequest.paymentStatus,
          repairStatus: "submitted",
          activeDisputes: existingRequest.activeDisputes,
          resolvedDisputes: existingRequest.resolvedDisputes,
          pointsGained: existingRequest.pointsGained,
          progressItems: existingRequest.progressItems,
          remarks: "Under review."
        })
      : existingRequest;
    const notification = request
      ? await createCreditRepairDocumentsUploadedNotification(
          req.auth.internalUserId,
          request
        )
      : null;
    await sendStoredNotificationToUser(req.auth.internalUserId, notification);

    return res.status(201).json({
      status: "success",
      message: "Document uploaded successfully",
      data: {
        document,
        request,
        notification
      }
    });
  } catch (error) {
    if (savedFile) {
      await deleteSavedFiles({ document: [savedFile] }).catch(() => null);
    }

    next(error);
  }
}

async function getMyCreditRepairDocuments(req, res, next) {
  try {
    const documents = await listCreditRepairDocumentsByUserId(req.auth.internalUserId);

    return res.status(200).json({
      status: "success",
      data: documents
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyCreditRepairDocuments,
  uploadCreditRepairDocument
};
