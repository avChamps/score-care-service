const express = require("express");
const {
  getGeneralDetails,
  getHomepageImageThemes
} = require("../controllers/general.controller");

const router = express.Router();

router.get("/", getGeneralDetails);
router.get("/homepage-image-themes", getHomepageImageThemes);

module.exports = router;
