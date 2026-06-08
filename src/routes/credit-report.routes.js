const express = require("express");
const {
  downloadCibilCreditReport,
  getSavedCibilCreditReport,
  getCibilCreditReport
} = require("../controllers/credit-report.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/cibil", requireAuth, getCibilCreditReport);
router.get("/cibil", requireAuth, getSavedCibilCreditReport);
router.get("/cibil/display-data", requireAuth, getSavedCibilCreditReport);
router.get("/cibil/download-report", requireAuth, downloadCibilCreditReport);

module.exports = router;
