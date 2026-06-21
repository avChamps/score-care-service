const express = require("express");
const {
  getWebsiteSettingsDetails
} = require("../controllers/website-setting.controller");

const router = express.Router();

router.get("/", getWebsiteSettingsDetails);

module.exports = router;
