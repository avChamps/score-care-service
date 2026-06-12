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
  listFeedbackByUserId,
  saveFeedbackByUserId: createFeedbackByUserId
};
