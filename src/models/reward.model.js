const { randomUUID } = require("crypto");
const { pool } = require("../config/db");
const { createCoinTransaction, getCoinBalance } = require("./coin.model");

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
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

function mapReward(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    type: row.type,
    value: Number(row.value),
    valueType: row.valueType,
    terms: row.terms,
    coinCost: Number(row.coinCost || 0),
    maxRedemptionsPerUser: row.maxRedemptionsPerUser === null
      ? null
      : Number(row.maxRedemptionsPerUser),
    validFrom: row.validFrom,
    validTo: row.validTo,
    isActive: Boolean(row.isActive),
    displayOrder: Number(row.displayOrder || 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapRedemption(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    userId: row.userPublicId,
    rewardId: row.rewardPublicId,
    rewardTitle: row.rewardTitle,
    rewardType: row.rewardType,
    coinsSpent: Number(row.coinsSpent),
    status: row.status,
    applyTo: row.applyTo,
    targetPublicId: row.targetPublicId,
    consumedAt: row.consumedAt,
    metadata: parseJson(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function rewardSelect() {
  return `SELECT
    rw.id AS internalId,
    rw.public_id AS publicId,
    rw.title,
    rw.description,
    rw.type,
    rw.value,
    rw.value_type AS valueType,
    rw.terms,
    rr.coin_cost AS coinCost,
    rr.max_redemptions_per_user AS maxRedemptionsPerUser,
    rr.valid_from AS validFrom,
    rr.valid_to AS validTo,
    rw.is_active AS isActive,
    rw.display_order AS displayOrder,
    rw.created_at AS createdAt,
    rw.updated_at AS updatedAt
  FROM rewards_catalog rw
  LEFT JOIN redemption_rules rr ON rr.reward_id = rw.id`;
}

async function listRewards({ activeOnly = true } = {}) {
  const where = activeOnly
    ? `WHERE rw.is_active = 1
      AND COALESCE(rr.is_active, 1) = 1
      AND (rr.valid_from IS NULL OR rr.valid_from <= NOW())
      AND (rr.valid_to IS NULL OR rr.valid_to >= NOW())`
    : "";
  const [rows] = await pool.query(
    `${rewardSelect()}
    ${where}
    ORDER BY rw.display_order ASC, rw.id ASC`
  );

  return rows.map(mapReward);
}

async function findRewardByPublicId(publicId, { activeOnly = false } = {}) {
  const where = activeOnly
    ? `WHERE rw.public_id = ?
      AND rw.is_active = 1
      AND COALESCE(rr.is_active, 1) = 1
      AND (rr.valid_from IS NULL OR rr.valid_from <= NOW())
      AND (rr.valid_to IS NULL OR rr.valid_to >= NOW())`
    : "WHERE rw.public_id = ?";
  const [rows] = await pool.query(`${rewardSelect()} ${where}`, [publicId]);
  const reward = mapReward(rows[0]);

  if (reward) {
    Object.defineProperty(reward, "internalId", {
      value: rows[0].internalId,
      enumerable: false
    });
  }

  return reward;
}

async function countUserRedemptions(userId, rewardId) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total
    FROM reward_redemptions
    WHERE user_id = ? AND reward_id = ? AND status IN ('pending', 'applied')`,
    [userId, rewardId]
  );

  return Number(row.total || 0);
}

async function redeemReward({
  userId,
  rewardPublicId,
  applyTo,
  targetPublicId,
  metadata
}) {
  const reward = await findRewardByPublicId(rewardPublicId, { activeOnly: true });

  if (!reward) {
    return {
      error: "Reward is invalid or inactive"
    };
  }

  if (reward.coinCost <= 0) {
    return {
      error: "Reward does not have a valid coin cost"
    };
  }

  const userRedemptions = await countUserRedemptions(userId, reward.internalId);

  if (
    reward.maxRedemptionsPerUser !== null &&
    userRedemptions >= reward.maxRedemptionsPerUser
  ) {
    return {
      error: "Maximum redemptions reached for this reward"
    };
  }

  const balance = await getCoinBalance(userId);

  if (balance.balance < reward.coinCost) {
    return {
      error: "Insufficient coin balance"
    };
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO reward_redemptions (
        public_id,
        user_id,
        reward_id,
        coins_spent,
        status,
        apply_to,
        target_public_id,
        metadata
      )
      VALUES (?, ?, ?, ?, 'applied', ?, ?, ?)`,
      [
        randomUUID(),
        userId,
        reward.internalId,
        reward.coinCost,
        applyTo || null,
        targetPublicId || null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    await createCoinTransaction(
      {
        userId,
        type: "redeem",
        source: "redemption",
        amount: -reward.coinCost,
        referenceType: "redemption",
        referenceId: result.insertId,
        description: `Redeemed ${reward.title}`,
        metadata: {
          rewardPublicId,
          applyTo,
          targetPublicId
        }
      },
      connection
    );

    await connection.commit();

    return {
      redemption: await findRedemptionById(result.insertId)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findRedemptionById(id) {
  const [rows] = await pool.query(
    `SELECT
      rd.public_id AS publicId,
      u.public_id AS userPublicId,
      rw.public_id AS rewardPublicId,
      rw.title AS rewardTitle,
      rw.type AS rewardType,
      rd.coins_spent AS coinsSpent,
      rd.status,
      rd.apply_to AS applyTo,
      rd.target_public_id AS targetPublicId,
      rd.consumed_at AS consumedAt,
      rd.metadata,
      rd.created_at AS createdAt,
      rd.updated_at AS updatedAt
    FROM reward_redemptions rd
    JOIN users u ON u.id = rd.user_id
    JOIN rewards_catalog rw ON rw.id = rd.reward_id
    WHERE rd.id = ?`,
    [id]
  );

  return mapRedemption(rows[0]);
}

function calculateRewardDiscount(reward, amount) {
  const baseAmount = Number(amount || 0);

  if (reward.valueType === "percentage") {
    return Number(Math.min(baseAmount, (baseAmount * Number(reward.value)) / 100).toFixed(2));
  }

  return Number(Math.min(baseAmount, Number(reward.value)).toFixed(2));
}

async function findSubscriptionRedemptionForCheckout({
  userId,
  redemptionPublicId,
  planPublicId,
  amount
}) {
  if (!redemptionPublicId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT
      rd.id AS internalId,
      rd.public_id AS publicId,
      rd.user_id AS userId,
      rd.status,
      rd.apply_to AS applyTo,
      rd.target_public_id AS targetPublicId,
      rd.razorpay_order_id AS razorpayOrderId,
      rd.consumed_at AS consumedAt,
      rw.public_id AS rewardPublicId,
      rw.title AS rewardTitle,
      rw.type AS rewardType,
      rw.value,
      rw.value_type AS valueType
    FROM reward_redemptions rd
    JOIN rewards_catalog rw ON rw.id = rd.reward_id
    WHERE rd.public_id = ? AND rd.user_id = ?
    LIMIT 1`,
    [redemptionPublicId, userId]
  );
  const redemption = rows[0];

  if (!redemption) {
    return {
      error: "Redemption not found for this user"
    };
  }

  if (redemption.rewardType !== "subscription_discount") {
    return {
      error: "This redemption cannot be used for subscription checkout"
    };
  }

  if (redemption.consumedAt) {
    return {
      error: "This redemption has already been used"
    };
  }

  if (redemption.targetPublicId && redemption.targetPublicId !== planPublicId) {
    return {
      error: "This redemption is not valid for the selected plan"
    };
  }

  const discountAmount = calculateRewardDiscount(
    {
      value: redemption.value,
      valueType: redemption.valueType
    },
    amount
  );

  return {
    redemption: {
      id: redemption.internalId,
      publicId: redemption.publicId,
      rewardPublicId: redemption.rewardPublicId,
      rewardTitle: redemption.rewardTitle,
      rewardType: redemption.rewardType,
      value: Number(redemption.value),
      valueType: redemption.valueType,
      discountAmount
    }
  };
}

async function attachRedemptionToOrder({
  redemptionId,
  razorpayOrderId,
  applyTo,
  targetPublicId
}) {
  const [result] = await pool.query(
    `UPDATE reward_redemptions
    SET
      razorpay_order_id = ?,
      apply_to = COALESCE(?, apply_to),
      target_public_id = COALESCE(?, target_public_id),
      updated_at = NOW()
    WHERE id = ? AND consumed_at IS NULL`,
    [razorpayOrderId, applyTo || null, targetPublicId || null, redemptionId]
  );

  return result.affectedRows > 0;
}

async function consumeSubscriptionRedemption({
  userId,
  redemptionPublicId,
  razorpayOrderId
}) {
  if (!redemptionPublicId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT rd.id
    FROM reward_redemptions rd
    JOIN rewards_catalog rw ON rw.id = rd.reward_id
    WHERE rd.public_id = ?
      AND rd.user_id = ?
      AND rw.type = 'subscription_discount'
      AND rd.consumed_at IS NULL
      AND (rd.razorpay_order_id IS NULL OR rd.razorpay_order_id = ?)
    LIMIT 1`,
    [redemptionPublicId, userId, razorpayOrderId]
  );

  if (!rows[0]) {
    return null;
  }

  await pool.query(
    `UPDATE reward_redemptions
    SET consumed_at = NOW(),
      razorpay_order_id = COALESCE(razorpay_order_id, ?),
      updated_at = NOW()
    WHERE id = ?`,
    [razorpayOrderId, rows[0].id]
  );

  return rows[0].id;
}

async function listMyRedemptions({ userId, page = 1, limit = 20 }) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(toPositiveInt(limit, 20), 100);
  const offset = (safePage - 1) * safeLimit;
  const [rows] = await pool.query(
    `SELECT
      rd.public_id AS publicId,
      u.public_id AS userPublicId,
      rw.public_id AS rewardPublicId,
      rw.title AS rewardTitle,
      rw.type AS rewardType,
      rd.coins_spent AS coinsSpent,
      rd.status,
      rd.apply_to AS applyTo,
      rd.target_public_id AS targetPublicId,
      rd.consumed_at AS consumedAt,
      rd.metadata,
      rd.created_at AS createdAt,
      rd.updated_at AS updatedAt
    FROM reward_redemptions rd
    JOIN users u ON u.id = rd.user_id
    JOIN rewards_catalog rw ON rw.id = rd.reward_id
    WHERE rd.user_id = ?
    ORDER BY rd.created_at DESC, rd.id DESC
    LIMIT ? OFFSET ?`,
    [userId, safeLimit, offset]
  );
  const [[countRow]] = await pool.query(
    "SELECT COUNT(*) AS total FROM reward_redemptions WHERE user_id = ?",
    [userId]
  );

  return {
    redemptions: rows.map(mapRedemption),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRow.total),
      totalPages: Math.ceil(Number(countRow.total) / safeLimit)
    }
  };
}

async function createReward(values) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO rewards_catalog (
        public_id,
        title,
        description,
        type,
        value,
        value_type,
        terms,
        is_active,
        display_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        values.title,
        values.description || null,
        values.type,
        values.value,
        values.valueType,
        values.terms || null,
        values.isActive,
        values.displayOrder
      ]
    );

    await connection.query(
      `INSERT INTO redemption_rules (
        reward_id,
        coin_cost,
        max_redemptions_per_user,
        valid_from,
        valid_to,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        result.insertId,
        values.coinCost,
        values.maxRedemptionsPerUser ?? null,
        values.validFrom || null,
        values.validTo || null,
        values.ruleIsActive
      ]
    );

    await connection.commit();

    const [rows] = await pool.query(
      "SELECT public_id AS publicId FROM rewards_catalog WHERE id = ?",
      [result.insertId]
    );

    return findRewardByPublicId(rows[0].publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateReward(publicId, values) {
  const reward = await findRewardByPublicId(publicId);

  if (!reward) {
    return null;
  }

  const rewardColumns = {
    title: "title",
    description: "description",
    type: "type",
    value: "value",
    valueType: "value_type",
    terms: "terms",
    isActive: "is_active",
    displayOrder: "display_order"
  };
  const ruleColumns = {
    coinCost: "coin_cost",
    maxRedemptionsPerUser: "max_redemptions_per_user",
    validFrom: "valid_from",
    validTo: "valid_to",
    ruleIsActive: "is_active"
  };
  const rewardEntries = Object.entries(values).filter(
    ([key, value]) => rewardColumns[key] && value !== undefined
  );
  const ruleEntries = Object.entries(values).filter(
    ([key, value]) => ruleColumns[key] && value !== undefined
  );
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (rewardEntries.length > 0) {
      await connection.query(
        `UPDATE rewards_catalog
        SET ${rewardEntries.map(([key]) => `${rewardColumns[key]} = ?`).join(", ")},
          updated_at = NOW()
        WHERE public_id = ?`,
        [...rewardEntries.map(([, value]) => value), publicId]
      );
    }

    if (ruleEntries.length > 0) {
      await connection.query(
        `UPDATE redemption_rules
        SET ${ruleEntries.map(([key]) => `${ruleColumns[key]} = ?`).join(", ")},
          updated_at = NOW()
        WHERE reward_id = ?`,
        [...ruleEntries.map(([, value]) => value), reward.internalId]
      );
    }

    await connection.commit();

    return findRewardByPublicId(publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteReward(publicId) {
  const [result] = await pool.query(
    "UPDATE rewards_catalog SET is_active = 0, updated_at = NOW() WHERE public_id = ?",
    [publicId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  attachRedemptionToOrder,
  consumeSubscriptionRedemption,
  createReward,
  deleteReward,
  findSubscriptionRedemptionForCheckout,
  listMyRedemptions,
  listRewards,
  redeemReward,
  updateReward
};
