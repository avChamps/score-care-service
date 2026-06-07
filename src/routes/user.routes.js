const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  getMyProfile,
  getUserLoginEvents,
  recordUserLogin,
  updateMyProfile
} = require("../controllers/user.controller");

const router = express.Router();

router.post("/login", recordUserLogin);
router.get("/me/profile", requireAuth, getMyProfile);
router.patch("/me/profile", requireAuth, updateMyProfile);
router.get("/:userId/login-events", getUserLoginEvents);

module.exports = router;
