const {
  createDispute,
  getDisputeSummaryByUserId,
  listDisputesByUserId
} = require("../models/dispute.model");
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

    return res.status(201).json({
      status: "success",
      message: "Dispute submitted successfully",
      data: {
        publicId: dispute.publicId,
        status: dispute.status,
        documents: dispute.documents
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

module.exports = {
  getMyDisputes,
  submitDispute
};
