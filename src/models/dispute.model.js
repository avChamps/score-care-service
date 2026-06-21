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
    userName: row.userName,
    email: row.email,
    mobileNumber: row.mobileNumber,
    accountData: parseJson(row.accountData, null),
    lenderName: row.lenderName,
    accountNumber: row.accountNumber,
    errorType: row.errorType,
    bureaus: parseJson(row.bureaus, []),
    additionalDetails: row.additionalDetails,
    remarks: row.remarks,
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
    remarks,
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

async function findDisputeByPublicId(publicId) {
  const [rows] = await pool.query(
    `${disputeSelect()}
    WHERE public_id = ?
    LIMIT 1`,
    [publicId]
  );

  return mapDispute(rows[0]);
}

async function listDisputes() {
  const [rows] = await pool.query(
    `SELECT
      cd.public_id AS publicId,
      cd.user_public_id AS userPublicId,
      u.full_name AS userName,
      u.email,
      u.mobile_number AS mobileNumber,
      cd.account_data AS accountData,
      cd.lender_name AS lenderName,
      cd.account_number AS accountNumber,
      cd.error_type AS errorType,
      cd.bureaus,
      cd.additional_details AS additionalDetails,
      cd.remarks,
      cd.documents,
      cd.status,
      cd.progress_step AS progressStep,
      cd.points_gained AS pointsGained,
      cd.submitted_at AS submittedAt,
      cd.resolved_at AS resolvedAt,
      cd.created_at AS createdAt,
      cd.updated_at AS updatedAt
    FROM credit_disputes cd
    LEFT JOIN users u ON u.public_id = cd.user_public_id
    ORDER BY cd.submitted_at DESC, cd.id DESC`
  );

  return rows.map(mapDispute);
}

async function updateDisputeByPublicId(publicId, values) {
  const entries = Object.entries({
    status: values.status,
    remarks: values.remarks,
    resolved_at:
      values.status === undefined
        ? undefined
        : values.status === "resolved"
          ? new Date()
          : null
  }).filter(([, value]) => value !== undefined);
  const setClause = entries.map(([column]) => `${column} = ?`).join(", ");
  const [result] = await pool.query(
    `UPDATE credit_disputes
    SET ${setClause},
      updated_at = NOW()
    WHERE public_id = ?`,
    [...entries.map(([, value]) => value), publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findDisputeByPublicId(publicId);
}

module.exports = {
  createDispute,
  findDisputeByPublicId,
  getDisputeSummaryByUserId,
  listDisputes,
  listDisputesByUserId,
  updateDisputeByPublicId
};
