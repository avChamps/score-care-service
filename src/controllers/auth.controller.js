const {
  sendMobileOtp,
  verifyMobileOtp
} = require("../services/msg91.service");
const {
  createLoginEvent,
  upsertUserForOtpLogin
} = require("../models/user.model");
const { createAuthToken } = require("../services/token.service");
const {
  sendUserLoginWhatsappAlert,
  sendUserCreatedWhatsappAlert
} = require("../services/whatsapp.service");
const {
  createFreeTierCreatedNotification
} = require("../models/notification.model");

const mobilePattern = /^[6-9]\d{9}$/;
const otpPattern = /^\d{4,9}$/;

function isProfileComplete(user) {
  return Boolean(user?.panNumber && user?.fullName);
}

async function sendOtp(req, res, next) {
  try {
    const mobileNumber = String(req.body.mobileNumber || "").trim();

    if (!mobilePattern.test(mobileNumber)) {
      return res.status(400).json({
        status: "error",
        message: "Valid 10 digit Indian mobile number is required"
      });
    }

    const otpResponse = await sendMobileOtp(mobileNumber);

    return res.status(200).json({
      status: "success",
      message: "OTP sent successfully",
      data: otpResponse
    });
  } catch (error) {
    next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const mobileNumber = String(req.body.mobileNumber || "").trim();
    const otp = String(req.body.otp || "").trim();

    if (!mobilePattern.test(mobileNumber)) {
      return res.status(400).json({
        status: "error",
        message: "Valid 10 digit Indian mobile number is required"
      });
    }

    if (!otpPattern.test(otp)) {
      return res.status(400).json({
        status: "error",
        message: "Valid OTP is required"
      });
    }

    const otpResponse = await verifyMobileOtp(mobileNumber, otp);
    const {
      user,
      isNewUser
    } = await upsertUserForOtpLogin(mobileNumber);
    const loginEventId = await createLoginEvent(user, {
      loginMethod: "otp",
      loginStatus: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      deviceId: req.body.deviceId || null,
      metadata: req.body.metadata || null
    });
    const whatsappAlert = isNewUser
      ? await sendUserCreatedWhatsappAlert(user)
      : await sendUserLoginWhatsappAlert(user, {
        loginMethod: "otp",
        ipAddress: req.ip,
        deviceId: req.body.deviceId || null
      });
    const freeTierNotification = isNewUser
      ? await createFreeTierCreatedNotification(user.internalId)
      : null;
    const token = createAuthToken({
      userId: user.publicId,
      mobileNumber,
      mobileVerified: true,
      tokenType: "access"
    });
    const profileComplete = isProfileComplete(user);
    const nextStep = profileComplete ? "dashboard" : "pan_details";

    return res.status(200).json({
      status: "success",
      message: "OTP verified successfully",
      data: {
        token,
        tokenType: "Bearer",
        mobileNumber,
        user,
        isNewUser,
        profileComplete,
        nextStep,
        shouldShowPanDetailsForm: !profileComplete,
        loginEventId,
        freeTierNotification,
        whatsappAlert,
        otpProvider: otpResponse
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sendOtp,
  verifyOtp
};
