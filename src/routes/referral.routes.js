const express = require("express");
const {
  applyMyReferralCode,
  getMyReferralDetails,
  getMyReferrals,
  resolveReferralCode
} = require("../controllers/referral.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/me", requireAuth, getMyReferralDetails);
router.post("/resolve", resolveReferralCode);
router.post("/apply", requireAuth, applyMyReferralCode);
router.get("/my-referrals", requireAuth, getMyReferrals);

module.exports = router;
