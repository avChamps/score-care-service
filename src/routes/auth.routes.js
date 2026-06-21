const express = require("express");
const {
  getAdminLoginEvents,
  getUserPermission,
  logoutAdmin,
  sendAdminOtp,
  sendOtp,
  verifyAdminAuthenticator,
  verifyAdminOtp,
  verifyOtp
} = require("../controllers/auth.controller");
const { requireAdmin, requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/admin/send-otp", sendAdminOtp);
router.post("/admin/verify-otp", verifyAdminOtp);
router.post("/admin/verify-authenticator", verifyAdminAuthenticator);
router.post("/admin/logout", requireAuth, logoutAdmin);
router.get("/admin/login-events", requireAuth, requireAdmin, getAdminLoginEvents);
router.get("/user-permission", requireAuth, getUserPermission);
router.post("/verify-otp", verifyOtp);

module.exports = router;
