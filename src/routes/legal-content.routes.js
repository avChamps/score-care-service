const express = require("express");
const {
  getLegalContentDetails
} = require("../controllers/legal-content.controller");

const router = express.Router();

router.get("/", getLegalContentDetails);

module.exports = router;
