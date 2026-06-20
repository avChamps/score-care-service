const { pool } = require("../config/db");

function mapHomepageImageTheme(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    imageName: row.imageName,
    fileName: row.fileName,
    isActive: Boolean(row.isActive)
  };
}

async function listActiveHomepageImageThemes() {
  const [rows] = await pool.query(
    `SELECT
      id,
      image_name AS imageName,
      file_name AS fileName,
      is_active AS isActive
    FROM homepage_image_themes
    WHERE is_active = 1
    ORDER BY id ASC`
  );

  return rows.map(mapHomepageImageTheme);
}

async function updateHomepageImageTheme(theme) {
  const [result] = await pool.query(
    `UPDATE homepage_image_themes
    SET
      file_name = ?,
      is_active = ?,
      updated_at = NOW()
    WHERE image_name = ?`,
    [
      theme.fileName,
      theme.isActive ? 1 : 0,
      theme.imageName
    ]
  );

  if (result.affectedRows === 0) {
    await pool.query(
      `INSERT INTO homepage_image_themes (
        image_name,
        file_name,
        is_active
      )
      VALUES (?, ?, ?)`,
      [
        theme.imageName,
        theme.fileName,
        theme.isActive ? 1 : 0
      ]
    );
  }

  const [rows] = await pool.query(
    `SELECT
      id,
      image_name AS imageName,
      file_name AS fileName,
      is_active AS isActive
    FROM homepage_image_themes
    WHERE image_name = ?
    ORDER BY id DESC
    LIMIT 1`,
    [theme.imageName]
  );

  return mapHomepageImageTheme(rows[0]);
}

async function deleteHomepageImageTheme(id) {
  const [result] = await pool.query(
    `UPDATE homepage_image_themes
    SET
      is_active = 0,
      updated_at = NOW()
    WHERE id = ?
      AND is_active = 1`,
    [id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  deleteHomepageImageTheme,
  listActiveHomepageImageThemes,
  updateHomepageImageTheme
};
