const { pool } = require("../config/db");

function mapContactMessage(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    emailAddress: row.emailAddress,
    message: row.message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function createContactMessage(values) {
  const [result] = await pool.query(
    `INSERT INTO contact_messages (
      first_name,
      last_name,
      email_address,
      message
    )
    VALUES (?, ?, ?, ?)`,
    [
      values.firstName,
      values.lastName,
      values.emailAddress,
      values.message
    ]
  );

  const [rows] = await pool.query(
    `SELECT
      id,
      first_name AS firstName,
      last_name AS lastName,
      email_address AS emailAddress,
      message,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM contact_messages
    WHERE id = ?`,
    [result.insertId]
  );

  return mapContactMessage(rows[0]);
}

module.exports = {
  createContactMessage
};
