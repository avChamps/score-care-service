const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function mapLoanOption(row) {
  return {
    id: row.publicId,
    publicId: row.publicId,
    optionType: row.optionType,
    label: row.label,
    value: row.value,
    displayOrder: row.displayOrder,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function groupLoanOptions(options) {
  return {
    loanTypes: options.filter((option) => option.optionType === "loan_type"),
    employmentTypes: options.filter((option) => option.optionType === "employment_type")
  };
}

function loanOptionSelect() {
  return `SELECT
    public_id AS publicId,
    option_type AS optionType,
    label,
    value,
    display_order AS displayOrder,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM loan_options`;
}

async function listActiveLoanOptions() {
  const [rows] = await pool.query(
    `${loanOptionSelect()}
    WHERE is_active = 1
    ORDER BY option_type ASC, display_order ASC, id ASC`
  );

  return groupLoanOptions(rows.map(mapLoanOption));
}

async function listAllLoanOptions() {
  const [rows] = await pool.query(
    `${loanOptionSelect()}
    ORDER BY option_type ASC, display_order ASC, id ASC`
  );

  return groupLoanOptions(rows.map(mapLoanOption));
}

async function replaceLoanOptions(options) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM loan_options");

    if (options.length > 0) {
      await connection.query(
        `INSERT INTO loan_options (
          public_id,
          option_type,
          label,
          value,
          display_order,
          is_active
        )
        VALUES ?`,
        [
          options.map((option) => [
            option.publicId || randomUUID(),
            option.optionType,
            option.label,
            option.value,
            option.displayOrder,
            option.isActive
          ])
        ]
      );
    }

    await connection.commit();

    return listAllLoanOptions();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listActiveLoanOptions,
  listAllLoanOptions,
  replaceLoanOptions
};
