const fs = require("fs/promises");

const {
  createCreditRepairDocument,
  listCreditRepairDocumentsByUserId
} = require("../models/credit-repair-document.model");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);

  return normalized || null;
}

function getUploadedFileUrl(req) {
  return `${req.protocol}://${req.get("host")}/uploads/credit-repair-documents/${req.file.filename}`;
}

function validateCreditRepairDocumentPayload(req) {
  const errors = [];
  const accountNumber = normalizeString(req.body.accountNumber);
  const accountType = normalizeString(req.body.accountType);
  const documentType = normalizeString(req.body.documentType);

  if (!accountNumber) {
    errors.push("accountNumber is required");
  }

  if (!accountType) {
    errors.push("accountType is required");
  }

  if (!documentType) {
    errors.push("documentType is required");
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
  try {
    const { errors, value } = validateCreditRepairDocumentPayload(req);

    if (errors.length > 0) {
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => null);
      }

      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const document = await createCreditRepairDocument(req.auth.internalUserId, {
      ...value,
      documentUrl: getUploadedFileUrl(req)
    });

    return res.status(201).json({
      status: "success",
      message: "Document uploaded successfully",
      data: document
    });
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => null);
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
