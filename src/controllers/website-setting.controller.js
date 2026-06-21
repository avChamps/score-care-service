const {
  getWebsiteSettings
} = require("../models/website-setting.model");

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

module.exports = {
  getWebsiteSettingsDetails
};
