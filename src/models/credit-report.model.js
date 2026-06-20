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

function mapCreditReport(row) {
  if (!row) {
    return null;
  }

  const report = {
    id: row.id,
    userId: row.userPublicId,
    userPublicId: row.userPublicId,
    provider: row.provider,
    reportType: row.reportType,
    clientId: row.clientId,
    name: row.name,
    mobile: row.mobile,
    pan: row.pan,
    gender: row.gender,
    userEmail: row.userEmail,
    creditScore: row.creditScore,
    creditReport: parseJson(row.creditReport),
    creditReportLink: row.creditReportLink,
    creditReportBase64: row.creditReportBase64,
    providerMessage: row.providerMessage,
    providerMessageCode: row.providerMessageCode,
    providerStatusCode: row.providerStatusCode,
    providerResponse: parseJson(row.providerResponse),
    fetchedAt: row.fetchedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };

  Object.defineProperty(report, "internalUserId", {
    value: row.internalUserId,
    enumerable: false
  });

  return report;
}

async function findCreditReportByUserId(userId, reportType) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS internalUserId,
      user_public_id AS userPublicId,
      provider,
      report_type AS reportType,
      client_id AS clientId,
      name,
      mobile,
      pan,
      gender,
      user_email AS userEmail,
      credit_score AS creditScore,
      credit_report AS creditReport,
      credit_report_link AS creditReportLink,
      credit_report_base64 AS creditReportBase64,
      provider_message AS providerMessage,
      provider_message_code AS providerMessageCode,
      provider_status_code AS providerStatusCode,
      provider_response AS providerResponse,
      fetched_at AS fetchedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM credit_reports
    WHERE user_id = ?
      AND provider = 'surepass'
      AND report_type = ?
    LIMIT 1`,
    [userId, reportType]
  );

  return mapCreditReport(rows[0]);
}

async function findCibilReportByUserId(userId) {
  return findCreditReportByUserId(userId, "cibil_pdf");
}

async function findCrifScoreByUserId(userId) {
  return findCreditReportByUserId(userId, "crif_score");
}

async function findCrifReportByUserId(userId) {
  return findCreditReportByUserId(userId, "crif_report");
}

async function findLatestSavedCreditReportByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS internalUserId,
      user_public_id AS userPublicId,
      provider,
      report_type AS reportType,
      client_id AS clientId,
      name,
      mobile,
      pan,
      gender,
      user_email AS userEmail,
      credit_score AS creditScore,
      credit_report AS creditReport,
      credit_report_link AS creditReportLink,
      credit_report_base64 AS creditReportBase64,
      provider_message AS providerMessage,
      provider_message_code AS providerMessageCode,
      provider_status_code AS providerStatusCode,
      provider_response AS providerResponse,
      fetched_at AS fetchedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM credit_reports
    WHERE user_id = ?
      AND provider = 'surepass'
      AND report_type IN ('crif_report', 'cibil_pdf')
    ORDER BY fetched_at DESC, updated_at DESC, id DESC
    LIMIT 1`,
    [userId]
  );

  return mapCreditReport(rows[0]);
}

async function saveSurepassCreditReport(userId, reportType, surepassResponse) {
  const data = surepassResponse.data || {};
  const [userRows] = await pool.query(
    "SELECT public_id AS publicId FROM users WHERE id = ?",
    [userId]
  );
  const userPublicId = userRows[0]?.publicId;

  if (!userPublicId) {
    const error = new Error("User public id is required");
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    `INSERT INTO credit_reports (
      user_id,
      user_public_id,
      provider,
      report_type,
      client_id,
      name,
      mobile,
      pan,
      gender,
      user_email,
      credit_score,
      credit_report,
      credit_report_link,
      credit_report_base64,
      provider_message,
      provider_message_code,
      provider_status_code,
      provider_response,
      fetched_at
    )
    VALUES (?, ?, 'surepass', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      user_public_id = VALUES(user_public_id),
      client_id = VALUES(client_id),
      name = VALUES(name),
      mobile = VALUES(mobile),
      pan = VALUES(pan),
      gender = VALUES(gender),
      user_email = VALUES(user_email),
      credit_score = VALUES(credit_score),
      credit_report = VALUES(credit_report),
      credit_report_link = VALUES(credit_report_link),
      credit_report_base64 = VALUES(credit_report_base64),
      provider_message = VALUES(provider_message),
      provider_message_code = VALUES(provider_message_code),
      provider_status_code = VALUES(provider_status_code),
      provider_response = VALUES(provider_response),
      fetched_at = NOW(),
      updated_at = NOW()`,
    [
      userId,
      userPublicId,
      reportType,
      data.client_id,
      data.name || null,
      data.mobile || null,
      data.pan || null,
      data.gender || null,
      data.user_email || null,
      data.credit_score || null,
      data.credit_report ? JSON.stringify(data.credit_report) : null,
      data.credit_report_link || null,
      data.credit_report_base64 || null,
      surepassResponse.message || null,
      surepassResponse.message_code || null,
      surepassResponse.status_code || null,
      JSON.stringify(surepassResponse)
    ]
  );

  return findCreditReportByUserId(userId, reportType);
}

async function saveCibilReport(userId, surepassResponse) {
  return saveSurepassCreditReport(userId, "cibil_pdf", surepassResponse);
}

async function saveCrifScore(userId, surepassResponse) {
  return saveSurepassCreditReport(userId, "crif_score", surepassResponse);
}

async function saveCrifReport(userId, surepassResponse) {
  return saveSurepassCreditReport(userId, "crif_report", surepassResponse);
}

async function saveCibilReportPdfBase64(userId, creditReportBase64) {
  await pool.query(
    `UPDATE credit_reports
    SET
      credit_report_base64 = ?,
      updated_at = NOW()
    WHERE user_id = ?
      AND provider = 'surepass'
      AND report_type = 'cibil_pdf'`,
    [creditReportBase64, userId]
  );

  return findCibilReportByUserId(userId);
}

async function saveCreditReportDownload(userId, creditReportId, reportType) {
  await pool.query(
    `INSERT INTO credit_report_downloads (
      user_id,
      credit_report_id,
      report_type,
      downloaded_at
    )
    VALUES (?, ?, ?, NOW())`,
    [userId, creditReportId || null, reportType]
  );
}

async function listCreditReportDownloadsByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      crd.id,
      crd.credit_report_id AS creditReportId,
      crd.report_type AS reportType,
      cr.provider,
      cr.credit_score AS creditScore,
      cr.fetched_at AS reportFetchedAt,
      crd.downloaded_at AS downloadedAt,
      crd.created_at AS createdAt
    FROM credit_report_downloads crd
    LEFT JOIN credit_reports cr
      ON cr.id = crd.credit_report_id
    WHERE crd.user_id = ?
    ORDER BY crd.downloaded_at DESC, crd.id DESC`,
    [userId]
  );

  return rows;
}

async function listAdminCreditReportDownloads(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const reportType = String(options.reportType || "").trim();
  const provider = String(options.provider || "").trim();
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.email LIKE ?
      OR u.pan_number LIKE ?
      OR cr.client_id LIKE ?
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

  if (reportType) {
    conditions.push("crd.report_type = ?");
    params.push(reportType);
  }

  if (provider) {
    conditions.push("cr.provider = ?");
    params.push(provider);
  }

  if (from) {
    conditions.push("crd.downloaded_at >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("crd.downloaded_at <= ?");
    params.push(totime);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const joins = `FROM credit_report_downloads crd
    INNER JOIN users u ON u.id = crd.user_id
    LEFT JOIN credit_reports cr ON cr.id = crd.credit_report_id`;
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      ${joins}
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        crd.id,
        crd.credit_report_id AS creditReportId,
        crd.report_type AS reportType,
        u.public_id AS userId,
        u.full_name AS fullName,
        u.mobile_number AS mobileNumber,
        u.email,
        u.pan_number AS panNumber,
        cr.provider,
        cr.client_id AS clientId,
        cr.credit_score AS creditScore,
        cr.fetched_at AS reportFetchedAt,
        crd.downloaded_at AS downloadedAt,
        crd.created_at AS createdAt
      ${joins}
      ${where}
      ORDER BY crd.downloaded_at DESC, crd.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    downloads: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function createManualCreditReportDownload(values) {
  const reportData = values.providerResponse.data || {};
  const publicId = randomUUID();

  await pool.query(
    `INSERT INTO manual_credit_report_downloads (
      public_id,
      bureau_type,
      client_id,
      name,
      first_name,
      last_name,
      mobile,
      pan,
      gender,
      credit_score,
      credit_report,
      credit_report_link,
      credit_report_base64,
      request_payload,
      provider_response,
      provider_status_code,
      provider_message,
      provider_message_code,
      downloaded_by_user_id,
      downloaded_by_employee_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      values.type,
      reportData.client_id,
      reportData.name || null,
      reportData.first_name || null,
      reportData.last_name || null,
      reportData.mobile || values.requestPayload.mobile,
      reportData.pan || values.requestPayload.pan,
      reportData.gender || values.requestPayload.gender || null,
      reportData.credit_score || null,
      reportData.credit_report
        ? JSON.stringify(reportData.credit_report)
        : null,
      reportData.credit_report_link,
      values.pdfBuffer.toString("base64"),
      JSON.stringify(values.requestPayload),
      JSON.stringify(values.providerResponse),
      values.providerResponse.status_code || null,
      values.providerResponse.message || null,
      values.providerResponse.message_code || null,
      values.downloadedByUserId || null,
      values.downloadedByEmployeeId || null
    ]
  );

  return publicId;
}

module.exports = {
  createManualCreditReportDownload,
  findCibilReportByUserId,
  findCrifReportByUserId,
  findCrifScoreByUserId,
  findLatestSavedCreditReportByUserId,
  listAdminCreditReportDownloads,
  listCreditReportDownloadsByUserId,
  saveCibilReport,
  saveCrifReport,
  saveCrifScore,
  saveCibilReportPdfBase64,
  saveCreditReportDownload
};
