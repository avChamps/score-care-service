const express = require("express");

const {
  getMyCreditRepairDocuments,
  uploadCreditRepairDocument
} = require("../controllers/credit-repair-document.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { creditRepairDocumentUpload } = require("../utils/upload-assets");

const router = express.Router();

router.get("/documents", requireAuth, getMyCreditRepairDocuments);
router.post("/documents", requireAuth, creditRepairDocumentUpload, uploadCreditRepairDocument);

module.exports = router;
