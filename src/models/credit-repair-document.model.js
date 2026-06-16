const { pool } = require("../config/db");

function mapCreditRepairDocument(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    creditReportId: row.creditReportId,
    accountNumber: row.accountNumber,
    accountType: row.accountType,
    bankName: row.bankName,
    issueType: row.issueType,
    documentType: row.documentType,
    documentUrl: row.documentUrl,
    closingDate: row.closingDate,
    remarks: row.remarks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function creditRepairDocumentSelect() {
  return `SELECT
    id,
    user_id AS userId,
    credit_report_id AS creditReportId,
    account_number AS accountNumber,
    account_type AS accountType,
    bank_name AS bankName,
    issue_type AS issueType,
    document_type AS documentType,
    document_url AS documentUrl,
    closing_date AS closingDate,
    remarks,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM credit_repair_documents`;
}

async function createCreditRepairDocument(userId, document) {
  const [result] = await pool.query(
    `INSERT INTO credit_repair_documents (
      user_id,
      credit_report_id,
      account_number,
      account_type,
      bank_name,
      issue_type,
      document_type,
      document_url,
      closing_date,
      remarks
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      document.creditReportId,
      document.accountNumber,
      document.accountType,
      document.bankName,
      document.issueType,
      document.documentType,
      document.documentUrl,
      document.closingDate,
      document.remarks
    ]
  );

  return findCreditRepairDocumentByIdAndUserId(result.insertId, userId);
}

async function findCreditRepairDocumentByIdAndUserId(id, userId) {
  const [rows] = await pool.query(
    `${creditRepairDocumentSelect()}
    WHERE id = ?
      AND user_id = ?
    LIMIT 1`,
    [id, userId]
  );

  return mapCreditRepairDocument(rows[0]);
}

async function listCreditRepairDocumentsByUserId(userId) {
  const [rows] = await pool.query(
    `${creditRepairDocumentSelect()}
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC`,
    [userId]
  );

  return rows.map(mapCreditRepairDocument);
}

module.exports = {
  createCreditRepairDocument,
  listCreditRepairDocumentsByUserId
};
