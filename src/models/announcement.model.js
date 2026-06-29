const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function formatDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function mapAnnouncement(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    publicId: row.publicId,
    title: row.title,
    startDate: formatDate(row.startDate),
    endDate: formatDate(row.endDate),
    createdAt: row.createdAt
  };
}

function announcementSelect() {
  return `SELECT
    id,
    public_id AS publicId,
    title,
    start_date AS startDate,
    end_date AS endDate,
    created_at AS createdAt
  FROM announcements`;
}

async function listAnnouncements(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
  const offset = (page - 1) * limit;

  const [[countRows], [rows]] = await Promise.all([
    pool.query("SELECT COUNT(*) AS total FROM announcements"),
    pool.query(
      `${announcementSelect()}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      OFFSET ?`,
      [limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    announcements: rows.map(mapAnnouncement),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function createAnnouncement(values) {
  const publicId = randomUUID();
  const [result] = await pool.query(
    `INSERT INTO announcements (
      public_id,
      title,
      start_date,
      end_date
    )
    VALUES (?, ?, ?, ?)`,
    [publicId, values.title, values.startDate, values.endDate]
  );
  const [rows] = await pool.query(
    `${announcementSelect()}
    WHERE id = ?
    LIMIT 1`,
    [result.insertId]
  );

  return mapAnnouncement(rows[0]);
}

async function updateAnnouncementByPublicId(publicId, values) {
  const [result] = await pool.query(
    `UPDATE announcements
    SET
      title = ?,
      start_date = ?,
      end_date = ?,
      updated_at = NOW()
    WHERE public_id = ?`,
    [values.title, values.startDate, values.endDate, publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `${announcementSelect()}
    WHERE public_id = ?
    LIMIT 1`,
    [publicId]
  );

  return mapAnnouncement(rows[0]);
}

async function deleteAnnouncementByPublicId(publicId) {
  const [result] = await pool.query(
    "DELETE FROM announcements WHERE public_id = ?",
    [publicId]
  );

  return result.affectedRows > 0;
}

module.exports = {
  createAnnouncement,
  deleteAnnouncementByPublicId,
  listAnnouncements,
  updateAnnouncementByPublicId
};
