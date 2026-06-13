const {
  getLegalContent,
  updateLegalContent
} = require("../models/legal-content.model");

async function getLegalContentDetails(_req, res, next) {
  try {
    const legalContent = await getLegalContent();

    return res.status(200).json({
      status: "success",
      data: legalContent
    });
  } catch (error) {
    next(error);
  }
}

function normalizeHtml(value) {
  return String(value || "").trim();
}

function validateLegalContentPayload(body) {
  return {
    errors: [],
    value: {
      termsAndConditions: normalizeHtml(body.termsAndConditions),
      privacyPolicy: normalizeHtml(body.privacyPolicy),
      consent: normalizeHtml(body.consent)
    }
  };
}

async function getAdminLegalContentDetails(_req, res, next) {
  try {
    const legalContent = await getLegalContent();

    return res.status(200).json({
      status: "success",
      data: legalContent
    });
  } catch (error) {
    next(error);
  }
}

async function saveAdminLegalContentDetails(req, res, next) {
  try {
    const { errors, value } = validateLegalContentPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const legalContent = await updateLegalContent(value);

    return res.status(200).json({
      status: "success",
      message: "Legal content updated successfully",
      data: legalContent
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminLegalContentDetails,
  getLegalContentDetails,
  saveAdminLegalContentDetails
};
