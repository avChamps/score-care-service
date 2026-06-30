const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  deleteMyAccount,
  getMyProfile,
  getMyNotificationPreferences,
  getUserLoginEvents,
  recordUserLogin,
  sendDeleteAccountOtp,
  updateMyNotificationPreferences,
  updateMySelectedLanguage,
  updateMyProfile
} = require("../controllers/user.controller");

const router = express.Router();

router.post("/login", recordUserLogin);
router.get("/notification-preferences", requireAuth, getMyNotificationPreferences);
router.patch("/notification-preferences", requireAuth, updateMyNotificationPreferences);
router.get("/me/profile", requireAuth, getMyProfile);
router.post("/me/delete-otp", requireAuth, sendDeleteAccountOtp);
router.delete("/me", requireAuth, deleteMyAccount);
router.patch("/me/language", requireAuth, updateMySelectedLanguage);
router.patch("/me/profile", requireAuth, updateMyProfile);
router.get("/:userId/login-events", getUserLoginEvents);

module.exports = router;
