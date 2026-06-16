const { pool } = require("../config/db");

function mapHomepageImageTheme(row) {
  if (!row) {
    return null;
  }

  return {
    imageName: row.imageName,
    fileName: row.fileName,
    isActive: Boolean(row.isActive)
  };
}

async function listActiveHomepageImageThemes() {
  const [rows] = await pool.query(
    `SELECT
      image_name AS imageName,
      file_name AS fileName,
      is_active AS isActive
    FROM homepage_image_themes
    WHERE is_active = 1
    ORDER BY id ASC`
  );

  return rows.map(mapHomepageImageTheme);
}

module.exports = {
  listActiveHomepageImageThemes
};
