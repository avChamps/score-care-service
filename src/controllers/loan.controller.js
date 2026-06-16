const {
  createLoanApplication,
  findLatestLoanApplicationByUserId
} = require("../models/loan-application.model");
const {
  listActiveLoanOptions,
  listAllLoanOptions,
  replaceLoanOptions
} = require("../models/loan-option.model");
const {
  createLoanAppliedNotification
} = require("../models/notification.model");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");
const {
  deleteSavedFiles,
  getPublicIdFromRequest,
  saveUploadedFiles
} = require("../utils/upload-assets");

const documentSpecs = [
  {
    key: "salarySlips",
    aliases: ["salarySlips"],
    maxCount: 8
  },
  {
    key: "bankStatements",
    aliases: ["bankStatements"],
    maxCount: 3
  },
  {
    key: "aadhaarCard",
    aliases: ["aadhaarCard", "aadharCard", "addharCard"],
    maxCount: 2
  },
  {
    key: "panCard",
    aliases: ["panCard", "pancard"],
    maxCount: 2
  }
];

function toPositiveNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeText(value) {
  return String(value || "").trim();
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

function getFilesForSpec(files, spec) {
  return spec.aliases.flatMap((field) => files?.[field] || []);
}

function getSavedFilesForSpec(files, spec) {
  return files.filter((file) => spec.aliases.includes(file.fieldName));
}

function validateLoanApplicationPayload(body, files) {
  const errors = [];
  const loanAmount = toPositiveNumber(body.loanAmount);
  const monthlyIncome = toPositiveNumber(body.monthlyIncome);
  const workExperience = normalizeText(body.workExperience);
  const loanType = normalizeText(body.loanType);
  const employmentType = normalizeText(body.employmentType);

  if (!loanAmount) {
    errors.push("Valid loan amount is required");
  }

  if (loanType.length < 2) {
    errors.push("Loan type is required");
  }

  if (employmentType.length < 2) {
    errors.push("Employment type is required");
  }

  if (!monthlyIncome) {
    errors.push("Valid monthly income is required");
  }

  if (workExperience.length < 1 || workExperience.length > 100) {
    errors.push("Valid work experience is required");
  }

  for (const spec of documentSpecs) {
    const uploadedFiles = getFilesForSpec(files, spec);

    if (uploadedFiles.length === 0) {
      errors.push(`${spec.key} file upload is required`);
    }

    if (uploadedFiles.length > spec.maxCount) {
      errors.push(`${spec.key} supports a maximum of ${spec.maxCount} files`);
    }
  }

  return {
    errors,
    value: {
      loanAmount,
      loanType,
      employmentType,
      monthlyIncome,
      workExperience
    }
  };
}

function mapDocuments(savedFiles = []) {
  return Object.fromEntries(
    documentSpecs.map((spec) => [
      spec.key,
      getSavedFilesForSpec(savedFiles, spec)
    ])
  );
}

function normalizeOptionPayload(options, optionType, errors, key) {
  if (!Array.isArray(options)) {
    errors.push(`${key} must be an array`);
    return [];
  }

  return options.map((option, index) => {
    const label = normalizeText(option.label);
    const value = normalizeText(option.value);
    const displayOrder =
      option.displayOrder === undefined ? index + 1 : Number(option.displayOrder);
    const isActive =
      option.isActive === undefined ? true : parseOptionalBoolean(option.isActive);

    if (!label) {
      errors.push(`${key}[${index}].label is required`);
    }

    if (!value) {
      errors.push(`${key}[${index}].value is required`);
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      errors.push(`${key}[${index}].displayOrder must be a non-negative integer`);
    }

    if (isActive === null) {
      errors.push(`${key}[${index}].isActive must be a boolean`);
    }

    return {
      publicId: normalizeText(option.publicId || option.id) || undefined,
      optionType,
      label,
      value,
      displayOrder,
      isActive
    };
  });
}

function validateLoanOptionsPayload(body) {
  const errors = [];
  const value = [
    ...normalizeOptionPayload(body.loanTypes, "loan_type", errors, "loanTypes"),
    ...normalizeOptionPayload(
      body.employmentTypes,
      "employment_type",
      errors,
      "employmentTypes"
    )
  ];

  return { errors, value };
}

async function getLoanOptions(_req, res, next) {
  try {
    const options = await listActiveLoanOptions();

    return res.status(200).json({
      status: "success",
      data: options
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminLoanOptions(_req, res, next) {
  try {
    const options = await listAllLoanOptions();

    return res.status(200).json({
      status: "success",
      data: options
    });
  } catch (error) {
    next(error);
  }
}

async function saveAdminLoanOptions(req, res, next) {
  try {
    const { errors, value } = validateLoanOptionsPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const options = await replaceLoanOptions(value);

    return res.status(200).json({
      status: "success",
      message: "Loan options updated successfully",
      data: options
    });
  } catch (error) {
    next(error);
  }
}

async function applyLoan(req, res, next) {
  let documents = {};

  try {
    const publicId = getPublicIdFromRequest(req);
    const { errors, value } = validateLoanApplicationPayload(req.body, req.files);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const savedFiles = await saveUploadedFiles(publicId, req.files);
    documents = mapDocuments(savedFiles);

    const loanApplication = await createLoanApplication(
      req.auth.internalUserId,
      publicId,
      {
        ...value,
        documents
      }
    );
    let notification = null;

    try {
      notification = await createLoanAppliedNotification(
        req.auth.internalUserId,
        loanApplication
      );
      await sendStoredNotificationToUser(req.auth.internalUserId, notification);
    } catch (notificationError) {
      notification = {
        status: "failed",
        message: notificationError.message
      };
    }

    return res.status(201).json({
      status: "success",
      success: true,
      message: "Loan application submitted successfully",
      data: {
        loanApplication,
        documents,
        notification
      }
    });
  } catch (error) {
    await deleteSavedFiles(documents);
    next(error);
  }
}

async function getMyLoanStatus(req, res, next) {
  try {
    const loanApplication = await findLatestLoanApplicationByUserId(
      req.auth.internalUserId
    );

    if (!loanApplication) {
      return res.status(404).json({
        status: "error",
        message: "Loan application not found"
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        id: loanApplication.id,
        loanAmount: loanApplication.loanAmount,
        loanType: loanApplication.loanType,
        applicationStatus: loanApplication.status,
        submittedAt: loanApplication.createdAt,
        updatedAt: loanApplication.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  applyLoan,
  getAdminLoanOptions,
  getLoanOptions,
  getMyLoanStatus,
  saveAdminLoanOptions
};
