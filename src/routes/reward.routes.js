const express = require("express");
const {
  getMyRedemptions,
  getRewards,
  redeemMyReward
} = require("../controllers/reward.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", requireAuth, getRewards);
router.get("/redemptions", requireAuth, getMyRedemptions);
router.post("/:publicId/redeem", requireAuth, redeemMyReward);

module.exports = router;
