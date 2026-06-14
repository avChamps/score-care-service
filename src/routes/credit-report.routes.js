const express = require("express");
const {
  downloadCibilCreditReport,
  getCreditReportDownloads,
  getExperianCreditReport,
  getExperianCreditScore,
  getSavedCibilCreditReport
} = require("../controllers/credit-report.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/cibil", requireAuth, getExperianCreditScore);
router.get("/cibil", requireAuth, getSavedCibilCreditReport);
router.get("/cibil/display-data", requireAuth, getExperianCreditReport);
router.post("/cibil/display-data", requireAuth, getExperianCreditReport);
router.get("/cibil/download-report", requireAuth, downloadCibilCreditReport);
router.get("/downloads", requireAuth, getCreditReportDownloads);
router.post("/experian/score", requireAuth, getExperianCreditScore);
router.post("/experian/fetch-report", requireAuth, getExperianCreditReport);

module.exports = router;
