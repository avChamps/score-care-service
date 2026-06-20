const {
  getGeneralSettings,
  updateGeneralSettings
} = require("../models/general-setting.model");
const {
  deleteHomepageImageTheme,
  listActiveHomepageImageThemes,
  updateHomepageImageTheme
} = require("../models/homepage-image-theme.model");
const {
  deleteSavedFiles,
  saveHomepageImageThemeFile
} = require("../utils/upload-assets");

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

async function deleteAdminHomepageImageTheme(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Valid id is required"
      });
    }

    const deleted = await deleteHomepageImageTheme(id);

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Homepage image theme not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Homepage image theme deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminHomepageImageTheme(req, res, next) {
  let savedFile = null;

  try {
    const imageName = normalizeString(req.body.imageName);
    const isActive = req.body.isActive === undefined
      ? true
      : String(req.body.isActive) === "true" || String(req.body.isActive) === "1";

    if (!imageName) {
      return res.status(400).json({
        status: "error",
        message: "imageName is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "image is required"
      });
    }

    savedFile = await saveHomepageImageThemeFile(req.file);

    const theme = await updateHomepageImageTheme({
      imageName,
      fileName: savedFile.url,
      isActive
    });

    return res.status(200).json({
      status: "success",
      message: "Homepage image theme updated successfully",
      data: theme
    });
  } catch (error) {
    if (savedFile) {
      await deleteSavedFiles({ homepageImageTheme: [savedFile] }).catch(() => null);
    }

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
  deleteAdminHomepageImageTheme,
  getAdminGeneralDetails,
  getGeneralDetails,
  getHomepageImageThemes,
  saveAdminGeneralDetails,
  updateAdminHomepageImageTheme
};
