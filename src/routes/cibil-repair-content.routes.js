const express = require("express");

const {
  createMyCibilRepairRequest,
  getMyCibilRepairRequest,
  getMyCibilRepairStatus,
  getCibilRepairContent
} = require("../controllers/cibil-repair-content.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getCibilRepairContent);
router.post("/requests", requireAuth, createMyCibilRepairRequest);
router.get("/requests/me", requireAuth, getMyCibilRepairRequest);
router.get("/requests/me/status", requireAuth, getMyCibilRepairStatus);

module.exports = router;
