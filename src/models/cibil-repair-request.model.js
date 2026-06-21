const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function parseJson(value) {
  if (!value || typeof value !== "string") {
    return value || null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function mapCibilRepairRequest(row) {
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
    planId: row.planPublicId,
    planPublicId: row.planPublicId,
    planName: row.planName,
    amount: Number(row.amount),
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    repairStatus: row.repairStatus,
    activeDisputes: Number(row.activeDisputes),
    resolvedDisputes: Number(row.resolvedDisputes),
    pointsGained: Number(row.pointsGained),
    progressItems: parseJson(row.progressItems) || [],
    remarks: row.remarks,
    accounts: parseJson(row.accounts) || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function requestSelect() {
  return `SELECT
    public_id AS publicId,
    user_public_id AS userPublicId,
    plan_public_id AS planPublicId,
    plan_name AS planName,
    amount,
    currency,
    payment_status AS paymentStatus,
    razorpay_order_id AS razorpayOrderId,
    razorpay_payment_id AS razorpayPaymentId,
    repair_status AS repairStatus,
    active_disputes AS activeDisputes,
    resolved_disputes AS resolvedDisputes,
    points_gained AS pointsGained,
    progress_items AS progressItems,
    remarks,
    accounts,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM cibil_repair_requests`;
}

async function createCibilRepairRequest(userId, userPublicId, request) {
  const publicId = randomUUID();

  await pool.query(
    `INSERT INTO cibil_repair_requests (
      public_id,
      user_id,
      user_public_id,
      plan_public_id,
      plan_name,
      amount,
      currency,
      payment_status,
      razorpay_order_id,
      razorpay_payment_id,
      repair_status,
      remarks,
      accounts
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      userId,
      userPublicId,
      request.planPublicId,
      request.planName,
      request.amount,
      request.currency,
      request.paymentStatus,
      request.razorpayOrderId,
      request.razorpayPaymentId,
      request.repairStatus,
      request.remarks,
      JSON.stringify(request.accounts || [])
    ]
  );

  return findCibilRepairRequestByPublicId(publicId);
}

async function findLatestCibilRepairRequestByUserId(userId) {
  const [rows] = await pool.query(
    `${requestSelect()}
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1`,
    [userId]
  );

  return mapCibilRepairRequest(rows[0]);
}

async function findCibilRepairRequestByPublicId(publicId) {
  const [rows] = await pool.query(
    `${requestSelect()}
    WHERE public_id = ?
    LIMIT 1`,
    [publicId]
  );

  return mapCibilRepairRequest(rows[0]);
}

async function findCibilRepairRequestByPublicIdAndUserId(publicId, userId) {
  const [rows] = await pool.query(
    `${requestSelect()}
    WHERE public_id = ?
      AND user_id = ?
    LIMIT 1`,
    [publicId, userId]
  );

  return mapCibilRepairRequest(rows[0]);
}

async function listCibilRepairRequestsByUserId(userId) {
  const [rows] = await pool.query(
    `${requestSelect()}
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC`,
    [userId]
  );

  return rows.map(mapCibilRepairRequest);
}

async function listCibilRepairRequests() {
  const [rows] = await pool.query(
    `SELECT
      crr.public_id AS publicId,
      crr.user_public_id AS userPublicId,
      u.full_name AS userName,
      u.email,
      u.mobile_number AS mobileNumber,
      crr.plan_public_id AS planPublicId,
      crr.plan_name AS planName,
      crr.amount,
      crr.currency,
      crr.payment_status AS paymentStatus,
      crr.razorpay_order_id AS razorpayOrderId,
      crr.razorpay_payment_id AS razorpayPaymentId,
      crr.repair_status AS repairStatus,
      crr.active_disputes AS activeDisputes,
      crr.resolved_disputes AS resolvedDisputes,
      crr.points_gained AS pointsGained,
      crr.progress_items AS progressItems,
      crr.remarks,
      crr.accounts,
      crr.created_at AS createdAt,
      crr.updated_at AS updatedAt
    FROM cibil_repair_requests crr
    INNER JOIN users u ON u.id = crr.user_id
    ORDER BY crr.created_at DESC, crr.id DESC`
  );

  return rows.map(mapCibilRepairRequest);
}

async function updateCibilRepairRequest(publicId, update) {
  const [result] = await pool.query(
    `UPDATE cibil_repair_requests
    SET
      payment_status = ?,
      repair_status = ?,
      active_disputes = ?,
      resolved_disputes = ?,
      points_gained = ?,
      progress_items = ?,
      remarks = ?,
      updated_at = NOW()
    WHERE public_id = ?`,
    [
      update.paymentStatus,
      update.repairStatus,
      update.activeDisputes,
      update.resolvedDisputes,
      update.pointsGained,
      JSON.stringify(update.progressItems || []),
      update.remarks,
      publicId
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findCibilRepairRequestByPublicId(publicId);
}

module.exports = {
  createCibilRepairRequest,
  findCibilRepairRequestByPublicId,
  findCibilRepairRequestByPublicIdAndUserId,
  findLatestCibilRepairRequestByUserId,
  listCibilRepairRequestsByUserId,
  listCibilRepairRequests,
  updateCibilRepairRequest
};
