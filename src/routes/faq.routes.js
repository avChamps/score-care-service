const express = require("express");
const { getFaqs } = require("../controllers/faq.controller");

const router = express.Router();

router.get("/", getFaqs);

module.exports = router;
