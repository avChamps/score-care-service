const express = require("express");
const {
  downloadCibilCreditReport,
  getCreditReportDownloads,
  getCrifCreditReport,
  getCrifCreditScore,
} = require("../controllers/credit-report.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/crif", requireAuth, getCrifCreditScore);
router.get("/cibil/display-data", requireAuth, getCrifCreditReport);
router.post("/cibil/display-data", requireAuth, getCrifCreditReport);
router.get("/cibil/download-report", requireAuth, downloadCibilCreditReport);
router.get("/downloads", requireAuth, getCreditReportDownloads);

module.exports = router;
