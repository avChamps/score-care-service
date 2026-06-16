const {
  createFeedbackByUserId,
  listAllFeedback,
  listFeedbackByUserId
} = require("../models/feedback.model");
const {
  createFeedbackSubmittedNotification
} = require("../models/notification.model");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");

function normalizeOptionalString(value) {
  return value === undefined || value === null ? null : String(value).trim() || null;
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return false;
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

function validateFeedbackPayload(body) {
  const errors = [];
  const rating =
    body.rating === undefined || body.rating === null || body.rating === ""
      ? null
      : Number(body.rating);
  const isLiked = parseOptionalBoolean(body.isLiked);
  const isDisliked = parseOptionalBoolean(body.isDisliked);

  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    errors.push("rating must be between 1 and 5");
  }

  if (isLiked === null) {
    errors.push("isLiked must be a boolean");
  }

  if (isDisliked === null) {
    errors.push("isDisliked must be a boolean");
  }

  if (isLiked && isDisliked) {
    errors.push("isLiked and isDisliked cannot both be true");
  }

  return {
    errors,
    value: {
      rating,
      message: normalizeOptionalString(body.message),
      isLiked,
      isDisliked
    }
  };
}

async function getMyFeedback(req, res, next) {
  try {
    const feedbacks = await listFeedbackByUserId(req.auth.internalUserId);

    return res.status(200).json({
      status: "success",
      data: {
        feedbacks
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAllFeedback(req, res, next) {
  try {
    const data = await listAllFeedback({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      from: req.query.from,
      totime: req.query.totime
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function saveMyFeedback(req, res, next) {
  try {
    const { errors, value } = validateFeedbackPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const feedback = await createFeedbackByUserId(req.auth.internalUserId, value);
    const notification = await createFeedbackSubmittedNotification(
      req.auth.internalUserId,
      feedback
    );
    await sendStoredNotificationToUser(req.auth.internalUserId, notification);

    return res.status(200).json({
      status: "success",
      message: "Feedback saved successfully",
      data: {
        feedback,
        notification
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllFeedback,
  getMyFeedback,
  saveMyFeedback
};
