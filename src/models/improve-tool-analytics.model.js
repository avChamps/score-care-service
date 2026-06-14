const { pool } = require("../config/db");

function mapImproveToolAnalytics(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    viewedAt: row.viewedAt,
    createdAt: row.createdAt
  };
}

async function createImproveToolAnalytics(userId) {
  const [result] = await pool.query(
    `INSERT INTO improve_tool_analytics (user_id)
    VALUES (?)`,
    [userId]
  );

  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      viewed_at AS viewedAt,
      created_at AS createdAt
    FROM improve_tool_analytics
    WHERE id = ?`,
    [result.insertId]
  );

  return mapImproveToolAnalytics(rows[0]);
}

module.exports = {
  createImproveToolAnalytics
};
