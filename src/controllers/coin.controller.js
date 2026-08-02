const {
  createCoinTransaction,
  getCoinBalance,
  getCoinSummary,
  listCoinRules,
  listCoinTransactions,
  updateCoinRule
} = require("../models/coin.model");
const { pool } = require("../config/db");
const { findUserByPublicId } = require("../models/user.model");

const transactionTypes = new Set(["earn", "redeem", "expire", "admin_adjustment"]);
const transactionSources = new Set([
  "referral_signup",
  "referral_kyc",
  "referral_subscription",
  "referral_milestone",
  "redemption",
  "manual"
]);

function normalizeString(value) {
  return String(value || "").trim();
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return null;
}

async function getMyCoinWallet(req, res, next) {
  try {
    const balance = await getCoinBalance(req.auth.internalUserId);

    return res.status(200).json({
      status: "success",
      data: {
        wallet: balance
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMyCoinTransactions(req, res, next) {
  try {
    const data = await listCoinTransactions({
      userId: req.auth.internalUserId,
      page: req.query.page,
      limit: req.query.limit,
      type: req.query.type,
      source: req.query.source
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminCoinSummary(_req, res, next) {
  try {
    const summary = await getCoinSummary();

    return res.status(200).json({
      status: "success",
      data: {
        summary
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminCoinRules(_req, res, next) {
  try {
    const rules = await listCoinRules();

    return res.status(200).json({
      status: "success",
      data: {
        rules
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminCoinRule(req, res, next) {
  try {
    const value = {};
    const errors = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "coinAmount")) {
      value.coinAmount = Number.parseInt(req.body.coinAmount, 10);

      if (!Number.isInteger(value.coinAmount) || value.coinAmount < 0) {
        errors.push("coinAmount must be a non-negative integer");
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "isActive")) {
      value.isActive = parseOptionalBoolean(req.body.isActive);

      if (value.isActive === null) {
        errors.push("isActive must be boolean");
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
      value.description = normalizeString(req.body.description) || null;
    }

    if (Object.keys(value).length === 0) {
      errors.push("At least one field is required");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const rule = await updateCoinRule(req.params.ruleKey, value);

    if (!rule) {
      return res.status(404).json({
        status: "error",
        message: "Coin rule not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Coin rule updated successfully",
      data: {
        rule
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminCoinTransactions(req, res, next) {
  try {
    const type = normalizeString(req.query.type);
    const source = normalizeString(req.query.source);
    let userId = null;

    if (type && !transactionTypes.has(type)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid transaction type"
      });
    }

    if (source && !transactionSources.has(source)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid transaction source"
      });
    }

    if (req.query.userPublicId) {
      const user = await findUserByPublicId(req.query.userPublicId);

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found"
        });
      }

      userId = user.internalId;
    }

    const data = await listCoinTransactions({
      userId,
      page: req.query.page,
      limit: req.query.limit,
      type,
      source
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function adjustAdminCoins(req, res, next) {
  try {
    const amount = Number.parseInt(req.body.amount, 10);
    const reason = normalizeString(req.body.reason);

    if (!Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({
        status: "error",
        message: "amount must be a non-zero integer"
      });
    }

    if (!reason) {
      return res.status(400).json({
        status: "error",
        message: "reason is required"
      });
    }

    const user = await findUserByPublicId(req.body.userPublicId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    const connection = await pool.getConnection();
    let transaction;

    try {
      await connection.beginTransaction();

      transaction = await createCoinTransaction(
        {
          userId: user.internalId,
          type: "admin_adjustment",
          source: "manual",
          amount,
          referenceType: "admin_adjustment",
          referenceId: req.auth.internalEmployeeId || req.auth.internalUserId,
          description: reason,
          metadata: {
            adjustedByUserId: req.auth.userId,
            adjustedByEmployeeId: req.auth.employeeId
          }
        },
        connection
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      status: "success",
      message: "Coins adjusted successfully",
      data: {
        balanceAfter: transaction.balanceAfter
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  adjustAdminCoins,
  getAdminCoinRules,
  getAdminCoinSummary,
  getAdminCoinTransactions,
  getMyCoinTransactions,
  getMyCoinWallet,
  updateAdminCoinRule
};
