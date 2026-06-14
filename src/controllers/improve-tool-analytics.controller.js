const {
  createImproveToolAnalytics
} = require("../models/improve-tool-analytics.model");

async function saveImproveToolAnalytics(req, res, next) {
  try {
    const analytics = await createImproveToolAnalytics(req.auth.internalUserId);

    return res.status(201).json({
      status: "success",
      message: "Improve tool analytics saved successfully",
      data: {
        analytics
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  saveImproveToolAnalytics
};
