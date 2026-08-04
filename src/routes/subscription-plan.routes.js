const express = require("express");
const {
  confirmGatewaySubscriptionPayment,
  createGatewaySubscription,
  getMySubscriptionStatus,
  handleRazorpaySubscriptionWebhook,
  getSubscriptionPlans
} = require("../controllers/subscription-plan.controller");
const { optionalAuth, requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", optionalAuth, getSubscriptionPlans);
router.get("/status", requireAuth, getMySubscriptionStatus);
router.post("/razorpay/confirm", requireAuth, confirmGatewaySubscriptionPayment);
router.post("/razorpay/webhook", handleRazorpaySubscriptionWebhook);
router.post("/:publicId/razorpay-subscription", requireAuth, createGatewaySubscription);

module.exports = router;
