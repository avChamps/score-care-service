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

async function findExperianScoreByUserId(userId) {
  return findCreditReportByUserId(userId, "experian_score");
}

async function findExperianReportByUserId(userId) {
  return findCreditReportByUserId(userId, "experian_report");
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
      AND report_type IN ('experian_report', 'cibil_pdf')
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

async function saveExperianScore(userId, surepassResponse) {
  return saveSurepassCreditReport(userId, "experian_score", surepassResponse);
}

async function saveExperianReport(userId, surepassResponse) {
  return saveSurepassCreditReport(userId, "experian_report", surepassResponse);
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

module.exports = {
  findCibilReportByUserId,
  findExperianReportByUserId,
  findExperianScoreByUserId,
  findLatestSavedCreditReportByUserId,
  saveCibilReport,
  saveExperianReport,
  saveExperianScore,
  saveCibilReportPdfBase64,
  saveCreditReportDownload
};
