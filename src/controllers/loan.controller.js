const {
  createLoanApplication,
  findLatestLoanApplicationByUserId
} = require("../models/loan-application.model");
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

    return res.status(201).json({
      status: "success",
      success: true,
      message: "Loan application submitted successfully",
      data: {
        loanApplication,
        documents
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
  getMyLoanStatus
};
