const { randomUUID } = require("crypto");
const { pool } = require("../config/db");
const {
  createCoinTransaction,
  getCoinRuleAmount
} = require("./coin.model");

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function mapReferralCode(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    userId: row.userPublicId,
    code: row.code,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt
  };
}

function mapReferral(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    referrerUserId: row.referrerPublicId,
    refereeUserId: row.refereePublicId,
    refereeName: row.refereeName,
    referralCode: row.referralCode,
    status: row.status,
    fraudStatus: row.fraudStatus,
    fraudReason: row.fraudReason,
    deviceId: row.deviceId,
    ipHash: row.ipHash,
    rewardedAt: row.rewardedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function buildReferralCode(userId) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";

  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `SC${String(userId).slice(-3)}${suffix}`;
}

async function getOrCreateReferralCode(userId) {
  const [existing] = await pool.query(
    `SELECT
      rc.public_id AS publicId,
      u.public_id AS userPublicId,
      rc.code,
      rc.is_active AS isActive,
      rc.created_at AS createdAt
    FROM referral_codes rc
    JOIN users u ON u.id = rc.user_id
    WHERE rc.user_id = ?`,
    [userId]
  );

  if (existing[0]) {
    return mapReferralCode(existing[0]);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const code = buildReferralCode(userId);
      await pool.query(
        `INSERT INTO referral_codes (public_id, user_id, code)
        VALUES (?, ?, ?)`,
        [randomUUID(), userId, code]
      );

      return getOrCreateReferralCode(userId);
    } catch (error) {
      if (error.code !== "ER_DUP_ENTRY") {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate referral code");
}

async function findReferralCode(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const [rows] = await pool.query(
    `SELECT
      rc.id AS internalId,
      rc.public_id AS publicId,
      rc.user_id AS internalUserId,
      u.public_id AS userPublicId,
      rc.code,
      rc.is_active AS isActive,
      rc.created_at AS createdAt
    FROM referral_codes rc
    JOIN users u ON u.id = rc.user_id
    WHERE rc.code = ? AND rc.is_active = 1`,
    [normalizedCode]
  );

  const referralCode = mapReferralCode(rows[0]);

  if (referralCode) {
    Object.defineProperty(referralCode, "internalUserId", {
      value: rows[0].internalUserId,
      enumerable: false
    });
  }

  return referralCode;
}

async function getReferralSummary(userId) {
  const [[counts]] = await pool.query(
    `SELECT
      COUNT(*) AS total,
      SUM(status = 'signed_up') AS signedUp,
      SUM(status = 'kyc_completed') AS kycCompleted,
      SUM(status = 'rewarded') AS rewarded,
      SUM(status = 'rejected') AS rejected,
      SUM(fraud_status = 'flagged') AS flagged
    FROM referrals
    WHERE referrer_user_id = ?`,
    [userId]
  );

  return {
    total: Number(counts.total || 0),
    signedUp: Number(counts.signedUp || 0),
    kycCompleted: Number(counts.kycCompleted || 0),
    rewarded: Number(counts.rewarded || 0),
    rejected: Number(counts.rejected || 0),
    flagged: Number(counts.flagged || 0)
  };
}

async function listMyReferrals({ userId, page = 1, limit = 20, status }) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(toPositiveInt(limit, 20), 100);
  const offset = (safePage - 1) * safeLimit;
  const where = ["r.referrer_user_id = ?"];
  const params = [userId];

  if (status) {
    where.push("r.status = ?");
    params.push(status);
  }

  const whereClause = `WHERE ${where.join(" AND ")}`;
  const [rows] = await pool.query(
    `SELECT
      r.public_id AS publicId,
      referrer.public_id AS referrerPublicId,
      referee.public_id AS refereePublicId,
      referee.full_name AS refereeName,
      r.referral_code AS referralCode,
      r.status,
      r.fraud_status AS fraudStatus,
      r.fraud_reason AS fraudReason,
      r.device_id AS deviceId,
      r.ip_hash AS ipHash,
      r.rewarded_at AS rewardedAt,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM referrals r
    JOIN users referrer ON referrer.id = r.referrer_user_id
    LEFT JOIN users referee ON referee.id = r.referee_user_id
    ${whereClause}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM referrals r ${whereClause}`,
    params
  );

  return {
    referrals: rows.map(mapReferral),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRow.total),
      totalPages: Math.ceil(Number(countRow.total) / safeLimit)
    }
  };
}

async function getFraudSignal({ referrerUserId, refereeUserId, deviceId, ipHash }) {
  if (referrerUserId === refereeUserId) {
    return {
      fraudStatus: "rejected",
      fraudReason: "Self-referral is not allowed"
    };
  }

  if (deviceId) {
    const [[deviceRow]] = await pool.query(
      `SELECT COUNT(*) AS total
      FROM referrals
      WHERE device_id = ? AND status <> 'rejected'`,
      [deviceId]
    );

    if (Number(deviceRow.total) >= 1) {
      return {
        fraudStatus: "flagged",
        fraudReason: "Same device used for multiple referrals"
      };
    }
  }

  if (ipHash) {
    const [[ipRow]] = await pool.query(
      `SELECT COUNT(*) AS total
      FROM referrals
      WHERE ip_hash = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [ipHash]
    );

    if (Number(ipRow.total) >= 5) {
      return {
        fraudStatus: "flagged",
        fraudReason: "Referral velocity from this IP is high"
      };
    }
  }

  return {
    fraudStatus: "clear",
    fraudReason: null
  };
}

async function applyReferralCode({
  refereeUserId,
  code,
  deviceId,
  ipHash
}) {
  const referralCode = await findReferralCode(code);

  if (!referralCode) {
    return {
      error: "Referral code is invalid or inactive"
    };
  }

  const [existingRows] = await pool.query(
    "SELECT id FROM referrals WHERE referee_user_id = ?",
    [refereeUserId]
  );

  if (existingRows[0]) {
    return {
      error: "Referral is already applied for this user"
    };
  }

  const fraud = await getFraudSignal({
    referrerUserId: referralCode.internalUserId,
    refereeUserId,
    deviceId,
    ipHash
  });

  if (fraud.fraudStatus === "rejected") {
    return {
      error: fraud.fraudReason
    };
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO referrals (
        public_id,
        referrer_user_id,
        referee_user_id,
        referral_code,
        status,
        device_id,
        ip_hash,
        fraud_status,
        fraud_reason
      )
      VALUES (?, ?, ?, ?, 'signed_up', ?, ?, ?, ?)`,
      [
        randomUUID(),
        referralCode.internalUserId,
        refereeUserId,
        referralCode.code,
        deviceId || null,
        ipHash || null,
        fraud.fraudStatus,
        fraud.fraudReason
      ]
    );

    if (fraud.fraudStatus === "clear") {
      const signupBonus = await getCoinRuleAmount("referee_signup_bonus", 50);
      const referrerBonus = await getCoinRuleAmount("referrer_kyc_bonus", 500);

      if (signupBonus > 0) {
        await createCoinTransaction(
          {
            userId: refereeUserId,
            type: "earn",
            source: "referral_signup",
            amount: signupBonus,
            referenceType: "referral",
            referenceId: result.insertId,
            description: "Welcome coins for joining with a referral code"
          },
          connection
        );
      }

      if (referrerBonus > 0) {
        await createCoinTransaction(
          {
            userId: referralCode.internalUserId,
            type: "earn",
            source: "referral_kyc",
            amount: referrerBonus,
            referenceType: "referral",
            referenceId: result.insertId,
            description: "Referral reward for completed onboarding"
          },
          connection
        );

        await connection.query(
          "UPDATE referrals SET status = 'rewarded', rewarded_at = NOW(), updated_at = NOW() WHERE id = ?",
          [result.insertId]
        );

        await maybeCreditMilestoneBonus(referralCode.internalUserId, connection);
      }
    }

    await connection.commit();

    return {
      referral: await findReferralById(result.insertId)
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findReferralById(id) {
  const [rows] = await pool.query(
    `SELECT
      r.public_id AS publicId,
      referrer.public_id AS referrerPublicId,
      referee.public_id AS refereePublicId,
      referee.full_name AS refereeName,
      r.referral_code AS referralCode,
      r.status,
      r.fraud_status AS fraudStatus,
      r.fraud_reason AS fraudReason,
      r.device_id AS deviceId,
      r.ip_hash AS ipHash,
      r.rewarded_at AS rewardedAt,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM referrals r
    JOIN users referrer ON referrer.id = r.referrer_user_id
    LEFT JOIN users referee ON referee.id = r.referee_user_id
    WHERE r.id = ?`,
    [id]
  );

  return mapReferral(rows[0]);
}

async function rewardKycCompletion({
  userId,
  panHash,
  aadhaarHash
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[referral]] = await connection.query(
      `SELECT id, referrer_user_id AS referrerUserId, fraud_status AS fraudStatus
      FROM referrals
      WHERE referee_user_id = ? AND status IN ('signed_up', 'kyc_completed')
      FOR UPDATE`,
      [userId]
    );

    if (!referral) {
      await connection.commit();
      return null;
    }

    await connection.query(
      `UPDATE referrals
      SET status = 'kyc_completed',
        pan_hash = COALESCE(?, pan_hash),
        aadhaar_hash = COALESCE(?, aadhaar_hash),
        updated_at = NOW()
      WHERE id = ?`,
      [panHash || null, aadhaarHash || null, referral.id]
    );

    if (referral.fraudStatus !== "clear" && referral.fraudStatus !== "approved") {
      await connection.commit();
      return findReferralById(referral.id);
    }

    const kycBonus = await getCoinRuleAmount("referrer_kyc_bonus", 500);

    if (kycBonus > 0) {
      await createCoinTransaction(
        {
          userId: referral.referrerUserId,
          type: "earn",
          source: "referral_kyc",
          amount: kycBonus,
          referenceType: "referral",
          referenceId: referral.id,
          description: "Referral reward for completed KYC"
        },
        connection
      );
    }

    await connection.query(
      "UPDATE referrals SET status = 'rewarded', rewarded_at = NOW(), updated_at = NOW() WHERE id = ?",
      [referral.id]
    );

    await maybeCreditMilestoneBonus(referral.referrerUserId, connection);

    await connection.commit();

    return findReferralById(referral.id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function maybeCreditMilestoneBonus(referrerUserId, connection) {
  const [[countRow]] = await connection.query(
    "SELECT COUNT(*) AS rewardedCount FROM referrals WHERE referrer_user_id = ? AND status = 'rewarded'",
    [referrerUserId]
  );
  const rewardedCount = Number(countRow.rewardedCount || 0);
  const milestones = {
    5: "referrer_5_success_bonus",
    10: "referrer_10_success_bonus"
  };
  const ruleKey = milestones[rewardedCount];

  if (!ruleKey) {
    return;
  }

  const amount = await getCoinRuleAmount(ruleKey, 0);

  if (amount <= 0) {
    return;
  }

  await createCoinTransaction(
    {
      userId: referrerUserId,
      type: "earn",
      source: "referral_milestone",
      amount,
      referenceType: "referral_milestone",
      referenceId: rewardedCount,
      description: `Milestone bonus for ${rewardedCount} successful referrals`
    },
    connection
  );
}

async function rewardSubscriptionCompletion({ userId, subscriptionPublicId }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[referral]] = await connection.query(
      `SELECT id, referrer_user_id AS referrerUserId, fraud_status AS fraudStatus
      FROM referrals
      WHERE referee_user_id = ? AND status IN ('kyc_completed', 'rewarded')
      FOR UPDATE`,
      [userId]
    );

    if (!referral || (referral.fraudStatus !== "clear" && referral.fraudStatus !== "approved")) {
      await connection.commit();
      return null;
    }

    const amount = await getCoinRuleAmount("referrer_subscription_bonus", 250);

    if (amount > 0) {
      const [[existingBonus]] = await connection.query(
        `SELECT id
        FROM coin_transactions
        WHERE user_id = ?
          AND source = 'referral_subscription'
          AND reference_type = 'subscription'
          AND reference_id = ?
        LIMIT 1`,
        [referral.referrerUserId, referral.id]
      );

      if (existingBonus) {
        await connection.commit();
        return findReferralById(referral.id);
      }

      await createCoinTransaction(
        {
          userId: referral.referrerUserId,
          type: "earn",
          source: "referral_subscription",
          amount,
          referenceType: "subscription",
          referenceId: referral.id,
          description: "Referral bonus for ScoreCare Pro subscription",
          metadata: {
            subscriptionPublicId
          }
        },
        connection
      );
    }

    await connection.commit();

    return findReferralById(referral.id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listAdminReferrals({
  page = 1,
  limit = 20,
  status,
  fraudStatus
}) {
  const safePage = toPositiveInt(page, 1);
  const safeLimit = Math.min(toPositiveInt(limit, 20), 100);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  if (status) {
    where.push("r.status = ?");
    params.push(status);
  }

  if (fraudStatus) {
    where.push("r.fraud_status = ?");
    params.push(fraudStatus);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT
      r.public_id AS publicId,
      referrer.public_id AS referrerPublicId,
      referee.public_id AS refereePublicId,
      referee.full_name AS refereeName,
      r.referral_code AS referralCode,
      r.status,
      r.fraud_status AS fraudStatus,
      r.fraud_reason AS fraudReason,
      r.device_id AS deviceId,
      r.ip_hash AS ipHash,
      r.rewarded_at AS rewardedAt,
      r.created_at AS createdAt,
      r.updated_at AS updatedAt
    FROM referrals r
    JOIN users referrer ON referrer.id = r.referrer_user_id
    LEFT JOIN users referee ON referee.id = r.referee_user_id
    ${whereClause}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM referrals r ${whereClause}`,
    params
  );

  return {
    referrals: rows.map(mapReferral),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: Number(countRow.total),
      totalPages: Math.ceil(Number(countRow.total) / safeLimit)
    }
  };
}

async function updateReferralFraudStatus(publicId, { fraudStatus, fraudReason }) {
  const [result] = await pool.query(
    `UPDATE referrals
    SET fraud_status = ?,
      fraud_reason = ?,
      status = CASE WHEN ? = 'rejected' THEN 'rejected' ELSE status END,
      updated_at = NOW()
    WHERE public_id = ?`,
    [fraudStatus, fraudReason || null, fraudStatus, publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query("SELECT id FROM referrals WHERE public_id = ?", [publicId]);

  return findReferralById(rows[0].id);
}

module.exports = {
  applyReferralCode,
  findReferralCode,
  getOrCreateReferralCode,
  getReferralSummary,
  listAdminReferrals,
  listMyReferrals,
  rewardKycCompletion,
  rewardSubscriptionCompletion,
  updateReferralFraudStatus
};
