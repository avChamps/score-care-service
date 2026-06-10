const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const {
  askGemini,
  streamGemini
} = require("../controllers/ai.controller");

const router = express.Router();

router.post("/gemini", requireAuth, askGemini);
router.post("/gemini/stream", requireAuth, streamGemini);

module.exports = router;
