const express = require("express");
const {
  getUserPermission,
  sendAdminOtp,
  sendOtp,
  verifyAdminOtp,
  verifyOtp
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/admin/send-otp", sendAdminOtp);
router.post("/admin/verify-otp", verifyAdminOtp);
router.get("/user-permission", requireAuth, getUserPermission);
router.post("/verify-otp", verifyOtp);

module.exports = router;
