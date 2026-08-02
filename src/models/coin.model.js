const { randomUUID } = require("crypto");
const { pool } = require("../config/db");

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function mapBalance(row) {
  return {
    balance: Number(row?.balance || 0),
    lifetimeEarned: Number(row?.lifetimeEarned || 0),
    lifetimeRedeemed: Number(row?.lifetimeRedeemed || 0),
    updatedAt: row?.updatedAt || null
  };
}

function mapTransaction(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    userId: row.userPublicId,
    type: row.type,
    source: row.source,
    amount: Number(row.amount),
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    balanceAfter: Number(row.balanceAfter),
    description: row.description,
    metadata: parseJson(row.metadata),
    createdAt: row.createdAt
  };
}

function mapCoinRule(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    ruleKey: row.ruleKey,
    coinAmount: Number(row.coinAmount),
    isActive: Boolean(row.isActive),
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

async function ensureCoinBalance(userId, connection = pool) {
  await connection.query(
    `INSERT IGNORE INTO coin_balances (user_id, balance, lifetime_earned, lifetime_redeemed)
    VALUES (?, 0, 0, 0)`,
    [userId]
  );
}

async function getCoinBalance(userId) {
  await ensureCoinBalance(userId);

  const [rows] = await pool.query(
    `SELECT
      balance,
      lifetime_earned AS lifetimeEarned,
      lifetime_redeemed AS lifetimeRedeemed,
      updated_at AS updatedAt
    FROM coin_balances
    WHERE user_id = ?`,
    [userId]
  );

  return mapBalance(rows[0]);
}

async function getCoinRuleAmount(ruleKey, fallback = 0) {
  const [rows] = await pool.query(
    `SELECT coin_amount AS coinAmount
    FROM coin_rule_settings
    WHERE rule_key = ? AND is_active = 1`,
    [ruleKey]
  );

  return Number(rows[0]?.coinAmount ?? fallback);
}

async function listCoinRules() {
  const [rows] = await pool.query(
    `SELECT
      id,
      rule_key AS ruleKey,
      coin_amount AS coinAmount,
      is_active AS isActive,
      description,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM coin_rule_settings
    ORDER BY id ASC`
  );

  return rows.map(mapCoinRule);
}

async function updateCoinRule(ruleKey, values) {
  const entries = Object.entries({
    coin_amount: values.coinAmount,
    is_active: values.isActive,
    description: values.description
  }).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    const [rows] = await pool.query(
      `SELECT
        id,
        rule_key AS ruleKey,
        coin_amount AS coinAmount,
        is_active AS isActive,
        description,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM coin_rule_settings
      WHERE rule_key = ?`,
      [ruleKey]
    );

    return mapCoinRule(rows[0]);
  }

  const [result] = await pool.query(
    `UPDATE coin_rule_settings
    SET ${entries.map(([column]) => `${column} = ?`).join(", ")},
      updated_at = NOW()
    WHERE rule_key = ?`,
    [...entries.map(([, value]) => value), ruleKey]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT
      id,
      rule_key AS ruleKey,
      coin_amount AS coinAmount,
      is_active AS isActive,
      description,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM coin_rule_settings
    WHERE rule_key = ?`,
    [ruleKey]
  );

  return mapCoinRule(rows[0]);
}

async function createCoinTransaction(values, connection = pool) {
  const amount = Number(values.amount || 0);

  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("Coin transaction amount must be a non-zero integer");
  }

  await ensureCoinBalance(values.userId, connection);

  const [[balanceRow]] = await connection.query(
    "SELECT balance FROM coin_balances WHERE user_id = ? FOR UPDATE",
    [values.userId]
  );
  const currentBalance = Number(balanceRow?.balance || 0);
  const balanceAfter = currentBalance + amount;

  if (balanceAfter < 0) {
    const error = new Error("Insufficient coin balance");
    error.statusCode = 400;
    throw error;
  }

  await connection.query(
    `UPDATE coin_balances
    SET
      balance = ?,
      lifetime_earned = lifetime_earned + ?,
      lifetime_redeemed = lifetime_redeemed + ?,
      updated_at = NOW()
    WHERE user_id = ?`,
    [
      balanceAfter,
      amount > 0 ? amount : 0,
      amount < 0 ? Math.abs(amount) : 0,
      values.userId
    ]
  );

  const [result] = await connection.query(
    `INSERT INTO coin_transactions (
      public_id,
      user_id,
      type,
      source,
      amount,
      reference_type,
      reference_id,
      balance_after,
      description,
      metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      values.userId,
      values.type,
      values.source,
      amount,
      values.referenceType || null,
      values.referenceId || null,
      balanceAfter,
      values.description || null,
      values.metadata ? JSON.stringify(values.metadata) : null
    ]
  );

  return {
    id: result.insertId,
    balanceAfter
  };
}

async function listCoinTransactions({
  userId,
  page = 1,
  limit = 20,
  type,
  source
}) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(toPositiveInt(limit, 20), 100);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  if (userId) {
    where.push("ct.user_id = ?");
    params.push(userId);
  }

  if (type) {
    where.push("ct.type = ?");
    params.push(type);
  }

  if (source) {
    where.push("ct.source = ?");
    params.push(source);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT
      ct.public_id AS publicId,
      u.public_id AS userPublicId,
      ct.type,
      ct.source,
      ct.amount,
      ct.reference_type AS referenceType,
      ct.reference_id AS referenceId,
      ct.balance_after AS balanceAfter,
      ct.description,
      ct.metadata,
      ct.created_at AS createdAt
    FROM coin_transactions ct
    JOIN users u ON u.id = ct.user_id
    ${whereClause}
    ORDER BY ct.created_at DESC, ct.id DESC
    LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total
    FROM coin_transactions ct
    ${whereClause}`,
    params
  );

  return {
    transactions: rows.map(mapTransaction),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRow.total),
      totalPages: Math.ceil(Number(countRow.total) / safeLimit)
    }
  };
}

async function getCoinSummary() {
  const [[summary]] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS totalIssued,
      COALESCE(SUM(CASE WHEN type = 'redeem' THEN ABS(amount) ELSE 0 END), 0) AS totalRedeemed,
      COALESCE(SUM(CASE WHEN type = 'expire' THEN ABS(amount) ELSE 0 END), 0) AS totalExpired
    FROM coin_transactions`
  );
  const [[balance]] = await pool.query(
    "SELECT COALESCE(SUM(balance), 0) AS outstandingCoins FROM coin_balances"
  );

  return {
    totalIssued: Number(summary.totalIssued),
    totalRedeemed: Number(summary.totalRedeemed),
    totalExpired: Number(summary.totalExpired),
    outstandingCoins: Number(balance.outstandingCoins)
  };
}

module.exports = {
  createCoinTransaction,
  getCoinBalance,
  getCoinRuleAmount,
  getCoinSummary,
  listCoinRules,
  updateCoinRule,
  listCoinTransactions
};
