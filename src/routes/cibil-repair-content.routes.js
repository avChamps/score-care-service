const express = require("express");

const {
  getCibilRepairContent
} = require("../controllers/cibil-repair-content.controller");

const router = express.Router();

router.get("/", getCibilRepairContent);

module.exports = router;
