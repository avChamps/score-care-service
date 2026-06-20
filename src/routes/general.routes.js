const express = require("express");
const {
  deleteAdminHomepageImageTheme,
  getGeneralDetails,
  getHomepageImageThemes,
  updateAdminHomepageImageTheme
} = require("../controllers/general.controller");
const {
  requireAdmin,
  requireAuth
} = require("../middleware/auth.middleware");
const { homepageImageThemeUpload } = require("../utils/upload-assets");

const router = express.Router();

router.get("/", getGeneralDetails);
router.get("/homepage-image-theme", getHomepageImageThemes);
router.patch(
  "/homepage-image-theme",
  requireAuth,
  requireAdmin,
  homepageImageThemeUpload,
  updateAdminHomepageImageTheme
);
router.delete(
  "/homepage-image-theme/:id",
  requireAuth,
  requireAdmin,
  deleteAdminHomepageImageTheme
);
router.get("/homepage-image-themes", getHomepageImageThemes);

module.exports = router;
