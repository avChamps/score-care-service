const {
  applyReferralCode,
  findReferralCode,
  getOrCreateReferralCode,
  getReferralSummary,
  listAdminReferrals,
  listMyReferrals,
  rewardKycCompletion,
  rewardSubscriptionCompletion,
  updateReferralFraudStatus
} = require("../models/referral.model");
const { findUserByPublicId } = require("../models/user.model");

const referralStatuses = new Set([
  "invited",
  "signed_up",
  "kyc_completed",
  "rewarded",
  "rejected"
]);
const fraudStatuses = new Set(["clear", "flagged", "approved", "rejected"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function getShareLink(req, code) {
  const baseUrl = normalizeString(process.env.APP_DEEP_LINK_BASE_URL) ||
    `${req.protocol}://${req.get("host")}/referral`;

  return `${baseUrl}?ref=${encodeURIComponent(code)}`;
}

async function getMyReferralDetails(req, res, next) {
  try {
    const referralCode = await getOrCreateReferralCode(req.auth.internalUserId);
    const summary = await getReferralSummary(req.auth.internalUserId);

    return res.status(200).json({
      status: "success",
      data: {
        referralCode: referralCode.code,
        shareLink: getShareLink(req, referralCode.code),
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

async function resolveReferralCode(req, res, next) {
  try {
    const code = normalizeString(req.body.code || req.query.code).toUpperCase();

    if (!code) {
      return res.status(400).json({
        status: "error",
        message: "code is required"
      });
    }

    const referralCode = await findReferralCode(code);

    if (!referralCode) {
      return res.status(404).json({
        status: "error",
        message: "Referral code is invalid or inactive"
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        valid: true,
        referralCode: referralCode.code,
        referrerUserId: referralCode.userId
      }
    });
  } catch (error) {
    next(error);
  }
}

async function applyMyReferralCode(req, res, next) {
  try {
    const code = normalizeString(req.body.code).toUpperCase();

    if (!code) {
      return res.status(400).json({
        status: "error",
        message: "code is required"
      });
    }

    const result = await applyReferralCode({
      refereeUserId: req.auth.internalUserId,
      code,
      deviceId: normalizeString(req.body.deviceId) || null,
      ipHash: normalizeString(req.body.ipHash) || null
    });

    if (result.error) {
      return res.status(400).json({
        status: "error",
        message: result.error
      });
    }

    return res.status(201).json({
      status: "success",
      message: "Referral applied successfully",
      data: {
        referral: result.referral
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyReferrals(req, res, next) {
  try {
    const status = normalizeString(req.query.status);

    if (status && !referralStatuses.has(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid referral status"
      });
    }

    const data = await listMyReferrals({
      userId: req.auth.internalUserId,
      page: req.query.page,
      limit: req.query.limit,
      status
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function recordKycCompleted(req, res, next) {
  try {
    const user = await findUserByPublicId(req.body.userPublicId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const referral = await rewardKycCompletion({
      userId: user.internalId,
      panHash: normalizeString(req.body.panHash) || null,
      aadhaarHash: normalizeString(req.body.aadhaarHash) || null
    });

    return res.status(200).json({
      status: "success",
      data: {
        referral
      }
    });
  } catch (error) {
    next(error);
  }
}

async function recordSubscriptionCompleted(req, res, next) {
  try {
    const user = await findUserByPublicId(req.body.userPublicId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const referral = await rewardSubscriptionCompletion({
      userId: user.internalId,
      subscriptionPublicId: normalizeString(req.body.subscriptionPublicId)
    });

    return res.status(200).json({
      status: "success",
      data: {
        referral
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminReferrals(req, res, next) {
  try {
    const status = normalizeString(req.query.status);
    const fraudStatus = normalizeString(req.query.fraudStatus);

    if (status && !referralStatuses.has(status)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid referral status"
      });
    }

    if (fraudStatus && !fraudStatuses.has(fraudStatus)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid fraud status"
      });
    }

    const data = await listAdminReferrals({
      page: req.query.page,
      limit: req.query.limit,
      status,
      fraudStatus
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminFraudQueue(req, res, next) {
  req.query.fraudStatus = "flagged";

  return getAdminReferrals(req, res, next);
}

async function updateAdminReferralFraudStatus(req, res, next) {
  try {
    const fraudStatus = normalizeString(req.body.fraudStatus);

    if (!fraudStatuses.has(fraudStatus)) {
      return res.status(400).json({
        status: "error",
        message: "Valid fraudStatus is required"
      });
    }

    const referral = await updateReferralFraudStatus(req.params.publicId, {
      fraudStatus,
      fraudReason: normalizeString(req.body.fraudReason || req.body.reason) || null
    });

    if (!referral) {
      return res.status(404).json({
        status: "error",
        message: "Referral not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Referral review updated successfully",
      data: {
        referral
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  applyMyReferralCode,
  getAdminFraudQueue,
  getAdminReferrals,
  getMyReferralDetails,
  getMyReferrals,
  recordKycCompleted,
  recordSubscriptionCompleted,
  resolveReferralCode,
  updateAdminReferralFraudStatus
};
