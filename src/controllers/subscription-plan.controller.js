const {
  createSubscriptionPlan,
  findSubscriptionPlanByPublicId,
  getDateFromUnix,
  listActiveSubscriptionPlans,
  listAllSubscriptionPlans,
  setPendingGatewaySubscription,
  updateGatewaySubscriptionPayment,
  updateGatewaySubscriptionStatus,
  updateSubscriptionPlanByPublicId
} = require("../models/subscription-plan.model");
const { findUserById } = require("../models/user.model");
const { findCibilReportByUserId } = require("../models/credit-report.model");
const {
  createAdminSubscriptionNotification
} = require("../models/admin-notification.model");
const {
  attachRedemptionToOrder,
  consumeSubscriptionRedemption,
  findSubscriptionRedemptionForCheckout
} = require("../models/reward.model");
const {
  sendMonthlyScoreChangedEmail
} = require("../services/profile-email.service");
const {
  createRazorpayCustomer,
  createRazorpayOrder,
  getRazorpayCredentials,
  normalizeRazorpayPrefill,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature
} = require("../services/razorpay.service");

const basicPlanPublicId = "scorecare-basic-monthly";

async function getSubscriptionPlans(_req, res, next) {
  try {
    const plans = await listActiveSubscriptionPlans();

    return res.status(200).json({
      status: "success",
      data: {
        plans
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAllSubscriptionPlans(_req, res, next) {
  try {
    const plans = await listAllSubscriptionPlans();

    return res.status(200).json({
      status: "success",
      data: {
        plans
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminBasicPlan(_req, res, next) {
  try {
    const plan = await findSubscriptionPlanByPublicId(basicPlanPublicId);

    return res.status(200).json({
      status: "success",
      data: {
        plan
      }
    });
  } catch (error) {
    next(error);
  }
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return undefined;
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

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === null ? null : normalizeString(value) || null;
}

function normalizeStringArray(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeBenefits(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          title: normalizeString(item.title),
          description: normalizeString(item.description)
        };
      }

      return normalizeString(item);
    })
    .filter((item) =>
      typeof item === "string"
        ? Boolean(item)
        : Boolean(item.title || item.description)
    );
}

function normalizeComparisonBenefits(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      benefit: normalizeString(item.benefit),
      free: item.free,
      scorecarePro: item.scorecarePro
    }))
    .filter((item) => item.benefit);
}

function toRazorpayAmount(amount) {
  return Math.round(Number(amount || 0)) / 100;
}

function getSubscriptionAmountBreakup(plan) {
  const amount = Number(plan.amount || 0);
  const gstPercentage = Number(plan.gstPercentage || 0);
  const gstAmount = Number(((amount * gstPercentage) / 100).toFixed(2));
  const finalAmount = Number((amount + gstAmount).toFixed(2));

  return {
    amount,
    gstPercentage,
    gstAmount,
    finalAmount,
    razorpayAmount: Math.round(finalAmount * 100)
  };
}

function applySubscriptionDiscount(amountBreakup, redemption) {
  const minimumRazorpayAmount = 1;
  const maxDiscountAmount = Math.max(
    0,
    amountBreakup.finalAmount - minimumRazorpayAmount
  );
  const discountAmount = Number(
    Math.min(Number(redemption?.discountAmount || 0), maxDiscountAmount).toFixed(2)
  );
  const payableAmount = Number(
    Math.max(minimumRazorpayAmount, amountBreakup.finalAmount - discountAmount).toFixed(2)
  );

  return {
    ...amountBreakup,
    grossAmount: amountBreakup.finalAmount,
    discountAmount,
    finalAmount: payableAmount,
    razorpayAmount: Math.round(payableAmount * 100),
    redemption: redemption || null
  };
}

function mapRazorpayPaymentStatus(status) {
  return status === "captured" || status === "authorized" ? "paid" : "failed";
}

function validateSubscriptionPlanPayload(body, { isCreate = false } = {}) {
  const errors = [];
  const value = {};

  if (isCreate) {
    value.publicId = normalizeString(body.publicId);

    if (!value.publicId) {
      errors.push("publicId is required");
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "planName")) {
    value.planName = normalizeString(body.planName);

    if (!value.planName) {
      errors.push("planName is required");
    }
  } else if (isCreate) {
    errors.push("planName is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "amount")) {
    value.amount = Number(body.amount);

    if (!Number.isFinite(value.amount) || value.amount < 0) {
      errors.push("amount must be a valid non-negative number");
    }
  } else if (isCreate) {
    errors.push("amount is required");
  }

  if (Object.prototype.hasOwnProperty.call(body, "gstPercentage")) {
    value.gstPercentage = Number(body.gstPercentage);

    if (!Number.isFinite(value.gstPercentage) || value.gstPercentage < 0) {
      errors.push("gstPercentage must be a valid non-negative number");
    }
  } else if (isCreate) {
    value.gstPercentage = 0;
  }

  if (Object.prototype.hasOwnProperty.call(body, "razorpayPlanId")) {
    value.razorpayPlanId = normalizeNullableString(body.razorpayPlanId);
  } else if (isCreate) {
    value.razorpayPlanId = null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    value.currency = normalizeString(body.currency).toUpperCase();

    if (!/^[A-Z]{3}$/.test(value.currency)) {
      errors.push("currency must be a 3-letter currency code");
    }
  } else if (isCreate) {
    value.currency = "INR";
  }

  if (Object.prototype.hasOwnProperty.call(body, "offerTag")) {
    value.offerTag = normalizeNullableString(body.offerTag);
  }

  if (Object.prototype.hasOwnProperty.call(body, "recommendedFor")) {
    value.recommendedFor = normalizeNullableString(body.recommendedFor);
  }

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    value.title = normalizeNullableString(body.title);
  }

  if (Object.prototype.hasOwnProperty.call(body, "subtitle")) {
    value.subtitle = normalizeNullableString(body.subtitle);
  }

  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    value.description = normalizeNullableString(body.description);
  }

  if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
    value.imageUrl = normalizeNullableString(body.imageUrl);
  }

  if (Object.prototype.hasOwnProperty.call(body, "benefits")) {
    value.benefits = normalizeBenefits(body.benefits);

    if (value.benefits === null) {
      errors.push("benefits must be an array");
    }
  } else if (isCreate) {
    value.benefits = [];
  }

  if (Object.prototype.hasOwnProperty.call(body, "comparisonBenefits")) {
    value.comparisonBenefits = normalizeComparisonBenefits(
      body.comparisonBenefits
    );

    if (value.comparisonBenefits === null) {
      errors.push("comparisonBenefits must be an array");
    }
  } else if (isCreate) {
    value.comparisonBenefits = [];
  }

  if (Object.prototype.hasOwnProperty.call(body, "features")) {
    value.features = normalizeStringArray(body.features);

    if (value.features === null) {
      errors.push("features must be an array");
    }
  } else if (isCreate) {
    value.features = [];
  }

  if (Object.prototype.hasOwnProperty.call(body, "buttonLabel")) {
    value.buttonLabel = normalizeNullableString(body.buttonLabel);
  }

  if (Object.prototype.hasOwnProperty.call(body, "skipLabel")) {
    value.skipLabel = normalizeNullableString(body.skipLabel);
  }

  if (Object.prototype.hasOwnProperty.call(body, "displayOrder")) {
    value.displayOrder = Number(body.displayOrder);

    if (!Number.isInteger(value.displayOrder) || value.displayOrder < 0) {
      errors.push("displayOrder must be a non-negative integer");
    }
  } else if (isCreate) {
    value.displayOrder = 0;
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    value.isActive = parseOptionalBoolean(body.isActive);

    if (value.isActive === null) {
      errors.push("isActive must be a boolean");
    }
  } else if (isCreate) {
    value.isActive = true;
  }

  if (!isCreate && Object.keys(value).length === 0) {
    errors.push("At least one subscription plan field is required");
  }

  return { errors, value };
}

async function createGatewaySubscription(req, res, next) {
  try {
    const plan = await findSubscriptionPlanByPublicId(req.params.publicId);

    if (!plan || !plan.isActive) {
      return res.status(404).json({
        status: "error",
        message: "Subscription plan not found"
      });
    }

    const user = await findUserById(req.auth.internalUserId);
    const prefill = normalizeRazorpayPrefill(user);
    const baseAmountBreakup = getSubscriptionAmountBreakup(plan);

    if (baseAmountBreakup.finalAmount < 1) {
      return res.status(400).json({
        status: "error",
        message: "Selected plan amount is below Razorpay minimum checkout amount"
      });
    }

    const redemptionPublicId = normalizeString(req.body.redemptionPublicId);
    const redemptionResult = await findSubscriptionRedemptionForCheckout({
      userId: req.auth.internalUserId,
      redemptionPublicId,
      planPublicId: plan.publicId,
      amount: baseAmountBreakup.finalAmount
    });

    if (redemptionResult?.error) {
      return res.status(400).json({
        status: "error",
        message: redemptionResult.error
      });
    }

    const amountBreakup = applySubscriptionDiscount(
      baseAmountBreakup,
      redemptionResult?.redemption
    );
    const customer = await createRazorpayCustomer({
      name: prefill.name || prefill.contact,
      email: prefill.email || undefined,
      contact: prefill.contact
    });

    const order = await createRazorpayOrder({
      amount: amountBreakup.finalAmount,
      currency: plan.currency,
      customerId: customer.id,
      method: "upi",
      receipt: `sub_${req.auth.internalUserId}_${Date.now()}`,
      token: {
        max_amount: amountBreakup.razorpayAmount,
        expire_at: Math.floor(Date.now() / 1000) + 30 * 365 * 24 * 60 * 60,
        frequency: "as_presented"
      },
      notes: {
        userId: req.auth.userId,
        internalUserId: String(req.auth.internalUserId),
        planPublicId: plan.publicId,
        redemptionPublicId: redemptionResult?.redemption?.publicId || ""
      }
    });

    if (redemptionResult?.redemption) {
      await attachRedemptionToOrder({
        redemptionId: redemptionResult.redemption.id,
        razorpayOrderId: order.id,
        applyTo: "subscription_plan",
        targetPublicId: plan.publicId
      });
    }

    await setPendingGatewaySubscription({
      userId: req.auth.internalUserId,
      planPublicId: plan.publicId,
      razorpaySubscriptionId: null
    });

    return res.status(201).json({
      status: "success",
      data: {
        keyId: getRazorpayCredentials().keyId,
        customerId: customer.id,
        prefill,
        recurring: "1",
        ...amountBreakup,
        plan,
        order
      }
    });
  } catch (error) {
    next(error);
  }
}

async function confirmGatewaySubscriptionPayment(req, res, next) {
  try {
    const razorpayOrderId = normalizeString(req.body.razorpayOrderId);
    const razorpayPaymentId = normalizeString(req.body.razorpayPaymentId);
    const razorpaySignature = normalizeString(req.body.razorpaySignature);

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        status: "error",
        message: "razorpayOrderId, razorpayPaymentId and razorpaySignature are required"
      });
    }

    const isValidSignature = verifyRazorpayPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    if (!isValidSignature) {
      return res.status(400).json({
        status: "error",
        message: "Invalid Razorpay signature"
      });
    }

    const amount = Number(req.body.amount || 0);
    const currency = normalizeString(req.body.currency || "INR").toUpperCase();
    const redemptionPublicId = normalizeString(req.body.redemptionPublicId);
    const discountAmount = Number(req.body.discountAmount || 0);
    const grossAmount = Number(req.body.grossAmount || amount);
    const rewardRedemptionId = await consumeSubscriptionRedemption({
      userId: req.auth.internalUserId,
      redemptionPublicId,
      razorpayOrderId
    });
    const plan = await updateGatewaySubscriptionPayment({
      userId: req.auth.internalUserId,
      razorpaySubscriptionId: null,
      razorpayPaymentId,
      amount,
      grossAmount,
      discountAmount,
      rewardRedemptionId,
      currency,
      paymentStatus: "paid",
      paidAt: new Date(),
      currentEnd: null,
      notes: {
        razorpayOrderId,
        source: "checkout_confirm",
        redemptionPublicId
      }
    });
    const [user, report] = await Promise.all([
      findUserById(req.auth.internalUserId),
      findCibilReportByUserId(req.auth.internalUserId)
    ]);
    const emailAlert = await sendMonthlyScoreChangedEmail(user, {
      creditScore: report?.creditScore
    });
    await createAdminSubscriptionNotification(user, {
      paymentId: razorpayPaymentId,
      planPublicId: plan?.publicId,
      amount,
      currency
    });

    return res.status(200).json({
      status: "success",
      message: "Subscription payment verified successfully",
      data: {
        emailAlert
      }
    });
  } catch (error) {
    next(error);
  }
}

async function handleRazorpaySubscriptionWebhook(req, res, next) {
  try {
    const razorpaySignature = normalizeString(req.get("x-razorpay-signature"));
    const isValidSignature = verifyRazorpayWebhookSignature({
      rawBody: req.rawBody,
      razorpaySignature
    });

    if (!isValidSignature) {
      return res.status(400).json({
        status: "error",
        message: "Invalid Razorpay webhook signature"
      });
    }

    const subscription = req.body.payload?.subscription?.entity;
    const payment = req.body.payload?.payment?.entity;

    if (req.body.event === "subscription.charged" && subscription && payment) {
      await updateGatewaySubscriptionPayment({
        razorpaySubscriptionId: subscription.id,
        razorpayPaymentId: payment.id,
        amount: toRazorpayAmount(payment.amount),
        currency: normalizeString(payment.currency || "INR").toUpperCase(),
        paymentStatus: mapRazorpayPaymentStatus(payment.status),
        paidAt: getDateFromUnix(payment.created_at),
        currentEnd: getDateFromUnix(subscription.current_end),
        notes: req.body
      });
    }

    if (subscription && ["subscription.cancelled", "subscription.completed"].includes(req.body.event)) {
      await updateGatewaySubscriptionStatus({
        razorpaySubscriptionId: subscription.id,
        subscriptionStatus: req.body.event === "subscription.cancelled" ? "cancelled" : "expired",
        currentEnd: getDateFromUnix(subscription.current_end)
      });
    }

    if (subscription && ["subscription.halted", "subscription.paused"].includes(req.body.event)) {
      await updateGatewaySubscriptionStatus({
        razorpaySubscriptionId: subscription.id,
        subscriptionStatus: "past_due",
        currentEnd: getDateFromUnix(subscription.current_end)
      });
    }

    return res.status(200).json({
      status: "success"
    });
  } catch (error) {
    next(error);
  }
}

async function createPlan(req, res, next) {
  try {
    const { errors, value } = validateSubscriptionPlanPayload(req.body, {
      isCreate: true
    });

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const plan = await createSubscriptionPlan(value);

    return res.status(201).json({
      status: "success",
      message: "Subscription plan created successfully",
      data: {
        plan
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: "error",
        message: "Subscription plan already exists"
      });
    }

    next(error);
  }
}

async function updateSubscriptionPlan(req, res, next) {
  try {
    const { errors, value } = validateSubscriptionPlanPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const plan = await updateSubscriptionPlanByPublicId(
      req.params.publicId,
      value
    );

    if (!plan) {
      return res.status(404).json({
        status: "error",
        message: "Subscription plan not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Subscription plan updated successfully",
      data: {
        plan
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: "error",
        message: "Subscription plan already exists"
      });
    }

    next(error);
  }
}

async function saveAdminBasicPlan(req, res, next) {
  try {
    const existingPlan = await findSubscriptionPlanByPublicId(basicPlanPublicId);
    const payload = existingPlan
      ? req.body
      : {
          ...req.body,
          publicId: basicPlanPublicId,
          planName: req.body.planName || "Basic"
        };
    const { errors, value } = validateSubscriptionPlanPayload(payload, {
      isCreate: !existingPlan
    });

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const plan = existingPlan
      ? await updateSubscriptionPlanByPublicId(basicPlanPublicId, value)
      : await createSubscriptionPlan(value);

    return res.status(200).json({
      status: "success",
      message: "Basic subscription plan updated successfully",
      data: {
        plan
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: "error",
        message: "Subscription plan already exists"
      });
    }

    next(error);
  }
}

module.exports = {
  confirmGatewaySubscriptionPayment,
  createPlan,
  createGatewaySubscription,
  getAdminBasicPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlans,
  handleRazorpaySubscriptionWebhook,
  saveAdminBasicPlan,
  updateSubscriptionPlan
};
