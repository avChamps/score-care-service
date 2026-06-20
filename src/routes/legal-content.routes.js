const express = require("express");
const {
  getLegalContentDetails,
  saveAdminLegalContentDetails
} = require("../controllers/legal-content.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", getLegalContentDetails);
router.patch("/", requireAuth, requireAdmin, saveAdminLegalContentDetails);

module.exports = router;
