const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function mapDispute(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    userId: row.userPublicId,
    userPublicId: row.userPublicId,
    accountData: parseJson(row.accountData, null),
    lenderName: row.lenderName,
    accountNumber: row.accountNumber,
    errorType: row.errorType,
    bureaus: parseJson(row.bureaus, []),
    additionalDetails: row.additionalDetails,
    documents: parseJson(row.documents, {}),
    status: row.status,
    progressStep: Number(row.progressStep),
    pointsGained: Number(row.pointsGained),
    submittedAt: row.submittedAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function disputeSelect() {
  return `SELECT
    public_id AS publicId,
    user_public_id AS userPublicId,
    account_data AS accountData,
    lender_name AS lenderName,
    account_number AS accountNumber,
    error_type AS errorType,
    bureaus,
    additional_details AS additionalDetails,
    documents,
    status,
    progress_step AS progressStep,
    points_gained AS pointsGained,
    submitted_at AS submittedAt,
    resolved_at AS resolvedAt,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM credit_disputes`;
}

async function createDispute(userId, userPublicId, dispute) {
  const publicId = randomUUID();

  await pool.query(
    `INSERT INTO credit_disputes (
      public_id,
      user_id,
      user_public_id,
      account_data,
      lender_name,
      account_number,
      error_type,
      bureaus,
      additional_details,
      documents
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      userId,
      userPublicId,
      JSON.stringify(dispute.accountData),
      dispute.lenderName,
      dispute.accountNumber,
      dispute.errorType,
      JSON.stringify(dispute.bureaus),
      dispute.additionalDetails,
      JSON.stringify(dispute.documents)
    ]
  );

  return findDisputeByPublicIdAndUserId(publicId, userId);
}

async function findDisputeByPublicIdAndUserId(publicId, userId) {
  const [rows] = await pool.query(
    `${disputeSelect()}
    WHERE public_id = ?
      AND user_id = ?
    LIMIT 1`,
    [publicId, userId]
  );

  return mapDispute(rows[0]);
}

async function listDisputesByUserId(userId) {
  const [rows] = await pool.query(
    `${disputeSelect()}
    WHERE user_id = ?
    ORDER BY submitted_at DESC, id DESC`,
    [userId]
  );

  return rows.map(mapDispute);
}

async function getDisputeSummaryByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      SUM(CASE WHEN status NOT IN ('resolved', 'rejected') THEN 1 ELSE 0 END) AS activeDisputes,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolvedDisputes,
      COALESCE(SUM(points_gained), 0) AS pointsGainedTotal
    FROM credit_disputes
    WHERE user_id = ?`,
    [userId]
  );

  return {
    activeDisputes: Number(rows[0]?.activeDisputes || 0),
    resolvedDisputes: Number(rows[0]?.resolvedDisputes || 0),
    pointsGainedTotal: Number(rows[0]?.pointsGainedTotal || 0)
  };
}

module.exports = {
  createDispute,
  getDisputeSummaryByUserId,
  listDisputesByUserId
};
