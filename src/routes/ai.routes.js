const express = require("express");
const { optionalAuth } = require("../middleware/auth.middleware");
const {
  askGemini
} = require("../controllers/ai.controller");

const router = express.Router();

router.post("/gemini", optionalAuth, askGemini);

module.exports = router;
