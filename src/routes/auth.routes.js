const express = require("express");
const {
  sendAdminOtp,
  sendOtp,
  verifyOtp
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/admin/send-otp", sendAdminOtp);
router.post("/verify-otp", verifyOtp);

module.exports = router;
