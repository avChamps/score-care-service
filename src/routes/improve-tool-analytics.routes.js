const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  saveImproveToolAnalytics
} = require("../controllers/improve-tool-analytics.controller");

const router = express.Router();

router.post("/", requireAuth, saveImproveToolAnalytics);

module.exports = router;
