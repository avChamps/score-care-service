const express = require("express");
const { getGeneralDetails } = require("../controllers/general.controller");

const router = express.Router();

router.get("/", getGeneralDetails);

module.exports = router;
