const express = require("express");

const {
  getMyDisputes,
  submitDispute
} = require("../controllers/dispute.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { disputeDocumentUpload } = require("../utils/upload-assets");

const router = express.Router();

router.get("/", requireAuth, getMyDisputes);
router.post("/", requireAuth, disputeDocumentUpload, submitDispute);

module.exports = router;
