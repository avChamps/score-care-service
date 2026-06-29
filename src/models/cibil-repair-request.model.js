const { randomUUID } = require("crypto");

const { pool } = require("../config/db");
const {
  listCreditRepairDocumentsByUserIds
} = require("./credit-repair-document.model");

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

  const request = {
    id: row.publicId,
    publicId: row.publicId,
    userId: row.userPublicId,
    userPublicId: row.userPublicId,
    userName: row.userName,
    email: row.email,
    mobileNumber: row.mobileNumber,
    ...(row.totalRepairRequests === undefined
      ? {}
      : {
          activeRepairRequests: Number(row.activeRepairRequests || 0),
          resolvedRepairRequests: Number(row.resolvedRepairRequests || 0),
          closedRepairRequests: Number(row.closedRepairRequests || 0),
          cancelledRepairRequests: Number(row.cancelledRepairRequests || 0),
          totalRepairRequests: Number(row.totalRepairRequests || 0)
        }),
    planId: row.planPublicId,
    planPublicId: row.planPublicId,
    planName: row.planName,
    amount: Number(row.amount),
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    razorpayOrderId: row.razorpayOrderId,
    razorpayPaymentId: row.razorpayPaymentId,
    repairStatus: row.repairStatus,
    bureau: row.bureau,
    activeDisputes: Number(row.activeDisputes),
    resolvedDisputes: Number(row.resolvedDisputes),
    pointsGained: Number(row.pointsGained),
    progressItems: parseJson(row.progressItems) || [],
    remarks: row.remarks,
    accounts: parseJson(row.accounts) || [],
    documents: row.documents || [],
    assignedEmployee: row.assignedEmployeePublicId
      ? {
          publicId: row.assignedEmployeePublicId,
          fullName: row.assignedEmployeeFullName
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };

  Object.defineProperty(request, "internalUserId", {
    value: row.internalUserId,
    enumerable: false
  });

  return request;
}

function attachDocumentsToAccounts(request, documents) {
  const documentsByAccountNumber = documents.reduce((result, document) => {
    const key = String(document.accountNumber || "").trim();

    if (!key) {
      return result;
    }

    const accountDocuments = result.get(key) || {};
    const documentType = document.documentType || "document";
    const existingDocuments = accountDocuments[documentType];

    accountDocuments[documentType] = existingDocuments
      ? [].concat(existingDocuments, document.documentUrl)
      : document.documentUrl;
    result.set(key, accountDocuments);

    return result;
  }, new Map());

  return {
    ...request,
    accounts: request.accounts.map((account) => ({
      ...account,
      documents: documentsByAccountNumber.get(
        String(account.accountNumber || "").trim()
      ) || {}
    })),
    documents
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
    bureau,
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

async function listCibilRepairRequests(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 10);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const repairStatus = String(options.repairStatus || options.status || "").trim();
  const paymentStatus = String(options.paymentStatus || "").trim();
  const assignedEmployeeId = Number(options.assignedEmployeeId) || null;
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    conditions.push(`(
      crr.public_id LIKE ?
      OR crr.user_public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.email LIKE ?
      OR u.mobile_number LIKE ?
      OR crr.plan_name LIKE ?
    )`);
    params.push(term, term, term, term, term, term);
  }

  if (repairStatus) {
    conditions.push("crr.repair_status = ?");
    params.push(repairStatus);
  }

  if (paymentStatus) {
    conditions.push("crr.payment_status = ?");
    params.push(paymentStatus);
  }

  if (assignedEmployeeId) {
    conditions.push("crr.assigned_employee_id = ?");
    params.push(assignedEmployeeId);
  }

  if (from) {
    conditions.push("crr.created_at >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("crr.created_at <= ?");
    params.push(totime);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM cibil_repair_requests crr
      INNER JOIN users u ON u.id = crr.user_id
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
      crr.user_id AS internalUserId,
      crr.public_id AS publicId,
      crr.user_public_id AS userPublicId,
      u.full_name AS userName,
      u.email,
      u.mobile_number AS mobileNumber,
      userRepairSummary.activeRepairRequests,
      userRepairSummary.resolvedRepairRequests,
      userRepairSummary.closedRepairRequests,
      userRepairSummary.cancelledRepairRequests,
      userRepairSummary.totalRepairRequests,
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
      crr.bureau,
      ae.public_id AS assignedEmployeePublicId,
      ae.full_name AS assignedEmployeeFullName,
      crr.created_at AS createdAt,
      crr.updated_at AS updatedAt
    FROM cibil_repair_requests crr
    INNER JOIN users u ON u.id = crr.user_id
    LEFT JOIN employees ae ON ae.id = crr.assigned_employee_id
    LEFT JOIN (
      SELECT
        user_id,
        SUM(CASE
          WHEN repair_status IN ('upload_document', 'submitted', 'under_review', 'analysis', 'in_progress')
          THEN 1 ELSE 0
        END) AS activeRepairRequests,
        SUM(CASE WHEN repair_status = 'resolved' THEN 1 ELSE 0 END) AS resolvedRepairRequests,
        SUM(CASE WHEN repair_status = 'closed' THEN 1 ELSE 0 END) AS closedRepairRequests,
        SUM(CASE WHEN repair_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledRepairRequests,
        COUNT(*) AS totalRepairRequests
      FROM cibil_repair_requests
      GROUP BY user_id
    ) userRepairSummary ON userRepairSummary.user_id = crr.user_id
    ${where}
    ORDER BY crr.created_at DESC, crr.id DESC
    LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);
  const requests = rows.map(mapCibilRepairRequest);
  const documents = await listCreditRepairDocumentsByUserIds(
    requests.map((request) => request.internalUserId)
  );
  const documentsByUserId = documents.reduce((result, document) => {
    const userDocuments = result.get(document.userId) || [];

    userDocuments.push(document);
    result.set(document.userId, userDocuments);

    return result;
  }, new Map());

  return {
    requests: requests.map((request) => (
      attachDocumentsToAccounts(
        request,
        documentsByUserId.get(request.internalUserId) || []
      )
    )),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
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

async function findAdminCibilRepairRequestDetail(publicId, options = {}) {
  const assignedEmployeeId = Number(options.assignedEmployeeId) || null;
  const assignedEmployeeCondition = assignedEmployeeId
    ? "AND crr.assigned_employee_id = ?"
    : "";
  const params = assignedEmployeeId
    ? [publicId, assignedEmployeeId]
    : [publicId];

  const [rows] = await pool.query(
    `SELECT
      crr.id AS internalId,
      crr.user_id AS internalUserId,
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
      crr.bureau,
      ae.public_id AS assignedEmployeePublicId,
      ae.full_name AS assignedEmployeeFullName,
      crr.created_at AS createdAt,
      crr.updated_at AS updatedAt
    FROM cibil_repair_requests crr
    INNER JOIN users u ON u.id = crr.user_id
    LEFT JOIN employees ae ON ae.id = crr.assigned_employee_id
    WHERE crr.public_id = ?
      ${assignedEmployeeCondition}
    LIMIT 1`,
    params
  );

  return mapCibilRepairRequest(rows[0]);
}

async function assignCibilRepairRequestEmployee(publicId, employeeId) {
  const [result] = await pool.query(
    `UPDATE cibil_repair_requests
    SET assigned_employee_id = ?,
      updated_at = NOW()
    WHERE public_id = ?`,
    [employeeId, publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findAdminCibilRepairRequestDetail(publicId);
}

async function updateCibilRepairRequestAccounts(publicId, accounts) {
  const [result] = await pool.query(
    `UPDATE cibil_repair_requests
    SET accounts = ?,
      updated_at = NOW()
    WHERE public_id = ?`,
    [JSON.stringify(accounts || []), publicId]
  );

  return result.affectedRows > 0;
}

async function createCibilRepairRequestTimeline(publicId, timeline) {
  const [result] = await pool.query(
    `INSERT INTO cibil_repair_request_timelines (
      request_id,
      title,
      description,
      actor_name
    )
    SELECT id, ?, ?, ?
    FROM cibil_repair_requests
    WHERE public_id = ?`,
    [
      timeline.title,
      timeline.description,
      timeline.actorName,
      publicId
    ]
  );

  return result.insertId;
}

async function listCibilRepairRequestTimelines(publicId) {
  const [rows] = await pool.query(
    `SELECT
      crt.id,
      crt.title,
      crt.description,
      crt.actor_name AS actorName,
      crt.created_at AS createdAt
    FROM cibil_repair_request_timelines crt
    INNER JOIN cibil_repair_requests crr ON crr.id = crt.request_id
    WHERE crr.public_id = ?
    ORDER BY crt.created_at ASC, crt.id ASC`,
    [publicId]
  );

  return rows;
}

module.exports = {
  assignCibilRepairRequestEmployee,
  createCibilRepairRequestTimeline,
  createCibilRepairRequest,
  findAdminCibilRepairRequestDetail,
  findCibilRepairRequestByPublicId,
  findCibilRepairRequestByPublicIdAndUserId,
  findLatestCibilRepairRequestByUserId,
  listCibilRepairRequestsByUserId,
  listCibilRepairRequests,
  listCibilRepairRequestTimelines,
  updateCibilRepairRequestAccounts,
  updateCibilRepairRequest
};
