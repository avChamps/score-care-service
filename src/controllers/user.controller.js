const {
  createLoginEvent,
  findUserById,
  findUserByPublicId,
  hasWelcomeEmailBeenSent,
  listLoginEventsByUserId,
  markWelcomeEmailSent,
  updateUserSelectedLanguage,
  updateUserProfile,
  upsertUserForLogin
} = require("../models/user.model");
const {
  sendUserLoginWhatsappAlert,
  sendUserCreatedWhatsappAlert
} = require("../services/whatsapp.service");
const {
  sendWelcomeEmail
} = require("../services/profile-email.service");
const {
  findCrifScoreByUserId
} = require("../models/credit-report.model");
const {
  createFreeTierCreatedNotification
} = require("../models/notification.model");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");

const mobilePattern = /^[6-9]\d{9}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthInternalUserId(req) {
  return req.auth.internalUserId || req.auth.userId;
}

function formatDateTime(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  const pad = (number) => String(number).padStart(2, "0");

  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate())
  ].join("-") + " " + [
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds())
  ].join(":");
}

function validateLoginPayload(body) {
  const errors = [];
  const mobileNumber = String(body.mobileNumber || "").trim();
  const panNumber = String(body.panNumber || "").trim().toUpperCase();
  const fullName = String(body.fullName || "").trim();

  if (!mobilePattern.test(mobileNumber)) {
    errors.push("Valid 10 digit Indian mobile number is required");
  }

  if (!panPattern.test(panNumber)) {
    errors.push("Valid PAN number is required");
  }

  if (fullName.length < 2) {
    errors.push("Full name is required");
  }

  return {
    errors,
    value: {
      mobileNumber,
      panNumber,
      fullName,
      email: body.email ? String(body.email).trim() : null,
      dateOfBirth: body.dateOfBirth || null,
      loginMethod: body.loginMethod || "otp",
      deviceId: body.deviceId || null,
      metadata: body.metadata || null
    }
  };
}

async function recordUserLogin(req, res, next) {
  try {
    const { errors, value } = validateLoginPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const {
      user,
      isNewUser
    } = await upsertUserForLogin(value);
    const loginEventId = await createLoginEvent(user, {
      loginMethod: value.loginMethod,
      loginStatus: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      deviceId: value.deviceId,
      metadata: value.metadata
    });
    const whatsappAlert = isNewUser
      ? await sendUserCreatedWhatsappAlert(user)
      : await sendUserLoginWhatsappAlert(user, {
        loginMethod: value.loginMethod,
        ipAddress: req.ip,
        deviceId: value.deviceId
      });
    const freeTierNotification = isNewUser
      ? await createFreeTierCreatedNotification(user.internalId)
      : null;
    await sendStoredNotificationToUser(user.internalId, freeTierNotification);

    return res.status(201).json({
      status: "success",
      data: {
        user,
        loginEventId,
        isNewUser,
        freeTierNotification,
        whatsappAlert
      }
    });
  } catch (error) {
    next(error);
  }
}

function validateProfilePayload(body) {
  const errors = [];
  const panNumber = String(body.panNumber || "").trim().toUpperCase();
  const fullName = String(body.fullName || "").trim();
  const email = body.email ? String(body.email).trim() : null;

  if (!panPattern.test(panNumber)) {
    errors.push("Valid PAN number is required");
  }

  if (fullName.length < 2) {
    errors.push("Full name is required");
  }

  if (email && !emailPattern.test(email)) {
    errors.push("Valid email is required");
  }

  return {
    errors,
    value: {
      panNumber,
      fullName,
      email,
      dateOfBirth: body.dateOfBirth || null,
      selectedLanguage: body.selectedLanguage
        ? String(body.selectedLanguage).trim()
        : null,
      sendWelcomeMail:
        body.sendWelcomeMail === true ||
        String(body.sendWelcomeMail || "").toLowerCase() === "true"
    }
  };
}

async function updateMyProfile(req, res, next) {
  try {
    const { errors, value } = validateProfilePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const user = await updateUserProfile(getAuthInternalUserId(req), value);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    let emailAlert = { status: "skipped", reason: "sendWelcomeMail flag is not true" };

    if (await hasWelcomeEmailBeenSent(user.internalId)) {
      emailAlert = { status: "skipped", reason: "Welcome email already sent" };
    } else if (value.sendWelcomeMail) {
      emailAlert = await sendWelcomeEmail(user);
    }

    if (emailAlert.status === "sent") {
      const wasMarkedSent = await markWelcomeEmailSent(user.internalId);
      if (wasMarkedSent) {
        user.welcomeEmailSentAt = new Date().toISOString();
      } else {
        emailAlert.tracking = "skipped";
        emailAlert.trackingReason = "welcome_email_sent_at column is not available";
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user,
        emailAlert
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateMySelectedLanguage(req, res, next) {
  try {
    const selectedLanguage = String(req.body.selectedLanguage || "").trim();

    if (!selectedLanguage) {
      return res.status(400).json({
        status: "error",
        errors: ["selectedLanguage is required"]
      });
    }

    const user = await updateUserSelectedLanguage(
      getAuthInternalUserId(req),
      selectedLanguage
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Selected language updated successfully",
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const internalUserId = getAuthInternalUserId(req);
    const user = await findUserById(internalUserId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const crifScore = await findCrifScoreByUserId(internalUserId);

    return res.status(200).json({
      status: "success",
      data: {
        user: {
          ...user,
          creditScore: crifScore?.creditScore || null,
          creditScoreSource: crifScore ? "crif" : null,
          creditScoreLastCheckedAt: formatDateTime(crifScore?.fetchedAt)
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getUserLoginEvents(req, res, next) {
  try {
    const user = await findUserByPublicId(req.params.userId) ||
      await findUserById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const loginEvents = await listLoginEventsByUserId(
      user.internalId,
      req.query.limit
    );

    return res.status(200).json({
      status: "success",
      data: {
        user,
        loginEvents
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyProfile,
  getUserLoginEvents,
  recordUserLogin,
  updateMySelectedLanguage,
  updateMyProfile
};
