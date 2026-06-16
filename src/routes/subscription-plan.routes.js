const express = require("express");
const {
  confirmGatewaySubscriptionPayment,
  createGatewaySubscription,
  handleRazorpaySubscriptionWebhook,
  getSubscriptionPlans
} = require("../controllers/subscription-plan.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getSubscriptionPlans);
router.post("/razorpay/confirm", requireAuth, confirmGatewaySubscriptionPayment);
router.post("/razorpay/webhook", handleRazorpaySubscriptionWebhook);
router.post("/:publicId/razorpay-subscription", requireAuth, createGatewaySubscription);

module.exports = router;
