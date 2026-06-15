const express = require("express");

const {
  createMyCibilRepairPaymentOrder,
  createMyCibilRepairRequest,
  getMyCibilRepairRequest,
  getMyCibilRepairRequestById,
  getMyCibilRepairStatus,
  getCibilRepairContent
} = require("../controllers/cibil-repair-content.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getCibilRepairContent);
router.post("/payments/orders", requireAuth, createMyCibilRepairPaymentOrder);
router.post("/requests", requireAuth, createMyCibilRepairRequest);
router.get("/requests/me", requireAuth, getMyCibilRepairRequest);
router.get("/requests/me/status", requireAuth, getMyCibilRepairStatus);
router.get("/requests/:publicId", requireAuth, getMyCibilRepairRequestById);
router.get("/requests/:publicId/status", requireAuth, getMyCibilRepairStatus);

module.exports = router;
