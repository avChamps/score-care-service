const express = require("express");
const { optionalAuth } = require("../middleware/auth.middleware");
const {
  askGemini,
  streamGemini
} = require("../controllers/ai.controller");

const router = express.Router();

router.post("/gemini", optionalAuth, askGemini);
router.post("/gemini/stream", optionalAuth, streamGemini);

module.exports = router;
