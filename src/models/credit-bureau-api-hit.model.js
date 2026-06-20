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

async function createCreditBureauApiHit(values) {
  await pool.query(
    `INSERT INTO credit_bureau_api_hits (
      public_id,
      bureau_type,
      operation_type,
      endpoint,
      mobile,
      pan,
      client_id,
      request_payload,
      response_payload,
      success,
      http_status,
      error_message,
      duration_ms,
      requested_by_user_id,
      requested_by_employee_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      values.bureauType,
      values.operationType,
      values.endpoint,
      values.requestPayload.mobile || null,
      values.requestPayload.pan || null,
      values.responsePayload?.data?.client_id || null,
      JSON.stringify(values.requestPayload),
      values.responsePayload ? JSON.stringify(values.responsePayload) : null,
      values.success ? 1 : 0,
      values.httpStatus || null,
      values.errorMessage || null,
      values.durationMs,
      values.requestedByUserId || null,
      values.requestedByEmployeeId || null
    ]
  );
}

function buildApiHitsWhere(options = {}) {
  const search = String(options.search || "").trim();
  const bureauType = String(options.bureauType || "").trim().toLowerCase();
  const operationType = String(options.operationType || "").trim().toLowerCase();
  const status = String(options.status || "").trim().toLowerCase();
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      cbah.public_id LIKE ?
      OR cbah.client_id LIKE ?
      OR cbah.mobile LIKE ?
      OR cbah.pan LIKE ?
      OR cbah.endpoint LIKE ?
      OR cbah.error_message LIKE ?
    )`);
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  if (bureauType) {
    conditions.push("cbah.bureau_type = ?");
    params.push(bureauType);
  }

  if (operationType) {
    conditions.push("cbah.operation_type = ?");
    params.push(operationType);
  }

  if (status === "success" || status === "failed") {
    conditions.push("cbah.success = ?");
    params.push(status === "success" ? 1 : 0);
  }

  if (from) {
    conditions.push("cbah.created_at >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push(
      /^\d{4}-\d{2}-\d{2}$/.test(totime)
        ? "cbah.created_at < DATE_ADD(?, INTERVAL 1 DAY)"
        : "cbah.created_at <= ?"
    );
    params.push(totime);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

async function listCreditBureauApiHits(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const includePayload = String(options.includePayload || "").toLowerCase() === "true";
  const { where, params } = buildApiHitsWhere(options);
  const payloadColumns = includePayload
    ? `cbah.request_payload AS requestPayload,
      cbah.response_payload AS responsePayload,`
    : "";
  const [[summaryRows], [bureauRows], [operationRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN cbah.success = 1 THEN 1 ELSE 0 END) AS successful,
        SUM(CASE WHEN cbah.success = 0 THEN 1 ELSE 0 END) AS failed,
        COALESCE(ROUND(AVG(cbah.duration_ms)), 0) AS averageDurationMs
      FROM credit_bureau_api_hits cbah
      ${where}`,
      params
    ),
    pool.query(
      `SELECT cbah.bureau_type AS label, COUNT(*) AS count
      FROM credit_bureau_api_hits cbah
      ${where}
      GROUP BY cbah.bureau_type
      ORDER BY cbah.bureau_type`,
      params
    ),
    pool.query(
      `SELECT cbah.operation_type AS label, COUNT(*) AS count
      FROM credit_bureau_api_hits cbah
      ${where}
      GROUP BY cbah.operation_type
      ORDER BY cbah.operation_type`,
      params
    ),
    pool.query(
      `SELECT
        cbah.public_id AS id,
        cbah.public_id AS publicId,
        cbah.bureau_type AS bureauType,
        cbah.operation_type AS operationType,
        cbah.endpoint,
        cbah.http_method AS httpMethod,
        cbah.mobile,
        cbah.pan,
        cbah.client_id AS clientId,
        ${payloadColumns}
        cbah.success,
        cbah.http_status AS httpStatus,
        cbah.error_message AS errorMessage,
        cbah.duration_ms AS durationMs,
        u.public_id AS requestedByUserId,
        u.full_name AS requestedByUserName,
        e.public_id AS requestedByEmployeeId,
        e.employee_code AS requestedByEmployeeCode,
        e.full_name AS requestedByEmployeeName,
        cbah.created_at AS createdAt
      FROM credit_bureau_api_hits cbah
      LEFT JOIN users u ON u.id = cbah.requested_by_user_id
      LEFT JOIN employees e ON e.id = cbah.requested_by_employee_id
      ${where}
      ORDER BY cbah.created_at DESC, cbah.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const summary = summaryRows[0] || {};
  const total = Number(summary.total || 0);

  return {
    summary: {
      total,
      successful: Number(summary.successful || 0),
      failed: Number(summary.failed || 0),
      averageDurationMs: Number(summary.averageDurationMs || 0),
      byBureau: bureauRows.map((row) => ({
        label: row.label,
        count: Number(row.count || 0)
      })),
      byOperation: operationRows.map((row) => ({
        label: row.label,
        count: Number(row.count || 0)
      }))
    },
    hits: rows.map((row) => ({
      ...row,
      success: Boolean(row.success),
      requestPayload: includePayload ? parseJson(row.requestPayload) : undefined,
      responsePayload: includePayload ? parseJson(row.responsePayload) : undefined
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  createCreditBureauApiHit,
  listCreditBureauApiHits
};
