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
    fileSize: row.fileSize === null || row.fileSize === undefined ? null : Number(row.fileSize),
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
    file_size AS fileSize,
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
      file_size,
      closing_date,
      remarks
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      document.creditReportId,
      document.accountNumber,
      document.accountType,
      document.bankName,
      document.issueType,
      document.documentType,
      document.documentUrl,
      document.fileSize ?? null,
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

async function listCreditRepairDocumentsByUserIdAndAccountNumbers(userId, accountNumbers) {
  const numbers = [...new Set(
    (accountNumbers || []).map((accountNumber) => String(accountNumber || "").trim()).filter(Boolean)
  )];

  if (!numbers.length) {
    return [];
  }

  const [rows] = await pool.query(
    `${creditRepairDocumentSelect()}
    WHERE user_id = ?
      AND account_number IN (?)
    ORDER BY created_at DESC, id DESC`,
    [userId, numbers]
  );

  return rows.map(mapCreditRepairDocument);
}

async function listCreditRepairDocumentsByUserIds(userIds) {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];

  if (!ids.length) {
    return [];
  }

  const [rows] = await pool.query(
    `${creditRepairDocumentSelect()}
    WHERE user_id IN (?)
    ORDER BY created_at DESC, id DESC`,
    [ids]
  );

  return rows.map(mapCreditRepairDocument);
}

module.exports = {
  createCreditRepairDocument,
  listCreditRepairDocumentsByUserIdAndAccountNumbers,
  listCreditRepairDocumentsByUserId,
  listCreditRepairDocumentsByUserIds
};
