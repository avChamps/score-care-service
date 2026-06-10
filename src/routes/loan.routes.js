const express = require("express");

const {
  applyLoan,
  getMyLoanStatus
} = require("../controllers/loan.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { loanApplicationUpload } = require("../utils/upload-assets");

const router = express.Router();

router.post("/apply", requireAuth, loanApplicationUpload, applyLoan);
router.get("/me/status", requireAuth, getMyLoanStatus);

module.exports = router;
