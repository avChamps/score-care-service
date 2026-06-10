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

function mapLoanApplication(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userPublicId,
    userPublicId: row.userPublicId,
    loanAmount: Number(row.loanAmount),
    loanType: row.loanType,
    employmentType: row.employmentType,
    monthlyIncome: Number(row.monthlyIncome),
    workExperience: row.workExperience,
    documents: parseJson(row.documents) || {},
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function createLoanApplication(userId, userPublicId, application) {
  const [result] = await pool.query(
    `INSERT INTO loan_applications (
      user_id,
      user_public_id,
      loan_amount,
      loan_type,
      employment_type,
      monthly_income,
      work_experience,
      documents
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      userPublicId,
      application.loanAmount,
      application.loanType,
      application.employmentType,
      application.monthlyIncome,
      application.workExperience,
      JSON.stringify(application.documents)
    ]
  );

  return findLoanApplicationById(result.insertId);
}

async function findLoanApplicationById(id) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS internalUserId,
      user_public_id AS userPublicId,
      loan_amount AS loanAmount,
      loan_type AS loanType,
      employment_type AS employmentType,
      monthly_income AS monthlyIncome,
      work_experience AS workExperience,
      documents,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM loan_applications
    WHERE id = ?`,
    [id]
  );

  return mapLoanApplication(rows[0]);
}

async function findLatestLoanApplicationByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS internalUserId,
      user_public_id AS userPublicId,
      loan_amount AS loanAmount,
      loan_type AS loanType,
      employment_type AS employmentType,
      monthly_income AS monthlyIncome,
      work_experience AS workExperience,
      documents,
      status,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM loan_applications
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1`,
    [userId]
  );

  return mapLoanApplication(rows[0]);
}

module.exports = {
  createLoanApplication,
  findLatestLoanApplicationByUserId,
  findLoanApplicationById
};
