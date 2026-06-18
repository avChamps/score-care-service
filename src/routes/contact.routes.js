const express = require("express");

const { submitContactMessage } = require("../controllers/contact.controller");

const router = express.Router();

router.post("/", submitContactMessage);

module.exports = router;
