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

async function listContactMessages(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      first_name LIKE ?
      OR last_name LIKE ?
      OR email_address LIKE ?
      OR message LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (from) {
    conditions.push("created_at >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("created_at <= ?");
    params.push(totime);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM contact_messages
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        id,
        first_name AS firstName,
        last_name AS lastName,
        email_address AS emailAddress,
        message,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM contact_messages
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    contactRequests: rows.map(mapContactMessage),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  createContactMessage,
  listContactMessages
};
