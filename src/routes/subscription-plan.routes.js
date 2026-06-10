const express = require("express");
const {
  getSubscriptionPlans
} = require("../controllers/subscription-plan.controller");

const router = express.Router();

router.get("/", getSubscriptionPlans);

module.exports = router;
