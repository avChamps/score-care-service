const {
  getGeneralSettings,
  updateGeneralSettings
} = require("../models/general-setting.model");
const {
  listActiveHomepageImageThemes
} = require("../models/homepage-image-theme.model");

async function getGeneralDetails(_req, res, next) {
  try {
    const general = await getGeneralSettings();

    return res.status(200).json({
      status: "success",
      data: general
    });
  } catch (error) {
    next(error);
  }
}

async function getHomepageImageThemes(_req, res, next) {
  try {
    const themes = await listActiveHomepageImageThemes();

    return res.status(200).json({
      status: "success",
      data: themes
    });
  } catch (error) {
    next(error);
  }
}

function normalizeString(value) {
  return String(value || "").trim();
}

function validateGeneralSettingsPayload(body) {
  const errors = [];
  const value = {
    website: normalizeString(body.website),
    email: normalizeString(body.email),
    mobileNumber: normalizeString(body.mobileNumber),
    whatsappNumber: normalizeString(body.whatsappNumber),
    selectedLanguage: normalizeString(body.selectedLanguage) || "English"
  };

  if (!value.website) {
    errors.push("website is required");
  }

  if (!value.email) {
    errors.push("email is required");
  }

  if (!value.mobileNumber) {
    errors.push("mobileNumber is required");
  }

  if (!value.whatsappNumber) {
    errors.push("whatsappNumber is required");
  }

  return { errors, value };
}

async function getAdminGeneralDetails(_req, res, next) {
  try {
    const general = await getGeneralSettings();

    return res.status(200).json({
      status: "success",
      data: general
    });
  } catch (error) {
    next(error);
  }
}

async function saveAdminGeneralDetails(req, res, next) {
  try {
    const { errors, value } = validateGeneralSettingsPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const general = await updateGeneralSettings(value);

    return res.status(200).json({
      status: "success",
      message: "General settings updated successfully",
      data: general
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminGeneralDetails,
  getGeneralDetails,
  getHomepageImageThemes,
  saveAdminGeneralDetails
};
