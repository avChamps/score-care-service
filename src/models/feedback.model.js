const { pool } = require("../config/db");

function mapFeedback(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    rating: row.rating,
    message: row.message,
    isLiked: Boolean(row.isLiked),
    isDisliked: Boolean(row.isDisliked),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapAdminFeedback(row) {
  const feedback = mapFeedback(row);

  if (!feedback) {
    return null;
  }

  return {
    ...feedback,
    user: {
      id: row.userPublicId,
      publicId: row.userPublicId,
      fullName: row.fullName,
      mobileNumber: row.mobileNumber,
      email: row.email
    }
  };
}

async function listAllFeedback(options = {}) {
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
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.email LIKE ?
      OR f.message LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (from) {
    conditions.push("f.created_at >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("f.created_at <= ?");
    params.push(totime);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM feedback f
      INNER JOIN users u ON u.id = f.user_id
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        f.id,
        f.user_id AS userId,
        f.rating,
        f.message,
        f.is_liked AS isLiked,
        f.is_disliked AS isDisliked,
        f.created_at AS createdAt,
        f.updated_at AS updatedAt,
        u.public_id AS userPublicId,
        u.full_name AS fullName,
        u.mobile_number AS mobileNumber,
        u.email
      FROM feedback f
      INNER JOIN users u ON u.id = f.user_id
      ${where}
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    feedbacks: rows.map(mapAdminFeedback),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function findFeedbackByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      rating,
      message,
      is_liked AS isLiked,
      is_disliked AS isDisliked,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM feedback
    WHERE user_id = ?`,
    [userId]
  );

  return mapFeedback(rows[0]);
}

async function listFeedbackByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      rating,
      message,
      is_liked AS isLiked,
      is_disliked AS isDisliked,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM feedback
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC`,
    [userId]
  );

  return rows.map(mapFeedback);
}

async function createFeedbackByUserId(userId, values) {
  const [result] = await pool.query(
    `INSERT INTO feedback (
      user_id,
      rating,
      message,
      is_liked,
      is_disliked
    )
    VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      values.rating,
      values.message,
      values.isLiked,
      values.isDisliked
    ]
  );

  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      rating,
      message,
      is_liked AS isLiked,
      is_disliked AS isDisliked,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM feedback
    WHERE id = ?`,
    [result.insertId]
  );

  return mapFeedback(rows[0]);
}

module.exports = {
  createFeedbackByUserId,
  findFeedbackByUserId,
  listAllFeedback,
  listFeedbackByUserId,
  saveFeedbackByUserId: createFeedbackByUserId
};
