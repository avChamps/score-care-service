const express = require("express");
const {
  getMyCoinTransactions,
  getMyCoinWallet
} = require("../controllers/coin.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/wallet", requireAuth, getMyCoinWallet);
router.get("/transactions", requireAuth, getMyCoinTransactions);

module.exports = router;
