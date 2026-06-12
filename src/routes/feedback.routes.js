const express = require("express");
const {
  getMyFeedback,
  saveMyFeedback
} = require("../controllers/feedback.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/me", requireAuth, getMyFeedback);
router.post("/", requireAuth, saveMyFeedback);

module.exports = router;
