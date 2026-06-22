const {
  getWebsiteSettings,
  updateWebsiteSettings
} = require("../models/website-setting.model");
const {
  deleteSavedFiles,
  saveWebsiteSettingsDocument
} = require("../utils/upload-assets");

async function getWebsiteSettingsDetails(_req, res, next) {
  try {
    const websiteSettings = await getWebsiteSettings();

    return res.status(200).json({
      status: "success",
      data: websiteSettings
    });
  } catch (error) {
    next(error);
  }
}

function normalizeString(value) {
  return String(value || "").trim();
}

function validateWebsiteSettingsPayload(body) {
  return {
    errors: [],
    value: {
      privacyPolicy: normalizeString(body.privacyPolicy || body.privacy_policy),
      termsOfService: normalizeString(body.termsOfService || body.terms_of_service),
      disclaimer: normalizeString(body.disclaimer),
      accountDeletion: normalizeString(body.accountDeletion || body.account_deletion)
    }
  };
}

function getUploadedFile(files, fieldName) {
  return Array.isArray(files?.[fieldName]) ? files[fieldName][0] : null;
}

async function saveUploadedWebsiteSettingsDocuments(files = {}) {
  const savedFiles = {};

  for (const fieldName of ["privacyPolicy", "termsOfService", "disclaimer", "accountDeletion"]) {
    const file = getUploadedFile(files, fieldName);

    if (file) {
      savedFiles[fieldName] = await saveWebsiteSettingsDocument(file);
    }
  }

  return savedFiles;
}

async function getAdminWebsiteSettingsDetails(_req, res, next) {
  try {
    const websiteSettings = await getWebsiteSettings();

    return res.status(200).json({
      status: "success",
      data: websiteSettings
    });
  } catch (error) {
    next(error);
  }
}

async function saveAdminWebsiteSettingsDetails(req, res, next) {
  let savedFiles = {};

  try {
    const { errors, value } = validateWebsiteSettingsPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const existingSettings = await getWebsiteSettings();
    savedFiles = await saveUploadedWebsiteSettingsDocuments(req.files);
    const websiteSettings = await updateWebsiteSettings({
      privacyPolicy: savedFiles.privacyPolicy?.url || value.privacyPolicy || existingSettings.privacyPolicy,
      termsOfService: savedFiles.termsOfService?.url || value.termsOfService || existingSettings.termsOfService,
      disclaimer: savedFiles.disclaimer?.url || value.disclaimer || existingSettings.disclaimer,
      accountDeletion: savedFiles.accountDeletion?.url || value.accountDeletion || existingSettings.accountDeletion
    });

    return res.status(200).json({
      status: "success",
      message: "Website settings updated successfully",
      data: websiteSettings
    });
  } catch (error) {
    await deleteSavedFiles(savedFiles).catch(() => null);
    next(error);
  }
}

module.exports = {
  getAdminWebsiteSettingsDetails,
  getWebsiteSettingsDetails,
  saveAdminWebsiteSettingsDetails
};
