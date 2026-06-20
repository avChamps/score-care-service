const {
  createContactMessage,
  listContactMessages
} = require("../models/contact-message.model");

function normalizeRequiredString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateContactPayload(body) {
  const value = {
    firstName: normalizeRequiredString(body.firstName),
    lastName: normalizeRequiredString(body.lastName),
    emailAddress: normalizeRequiredString(body.emailAddress),
    message: normalizeRequiredString(body.message)
  };
  const errors = [];

  if (!value.firstName) {
    errors.push("firstName is required");
  }

  if (!value.lastName) {
    errors.push("lastName is required");
  }

  if (!value.emailAddress) {
    errors.push("emailAddress is required");
  } else if (!isValidEmail(value.emailAddress)) {
    errors.push("emailAddress must be a valid email");
  }

  if (!value.message) {
    errors.push("message is required");
  }

  return {
    errors,
    value
  };
}

async function submitContactMessage(req, res, next) {
  try {
    const { errors, value } = validateContactPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    await createContactMessage(value);

    return res.status(201).json({
      status: "success",
      message: "Contact message submitted successfully"
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminContactRequests(req, res, next) {
  try {
    const data = await listContactMessages({
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

module.exports = {
  getAdminContactRequests,
  submitContactMessage
};
