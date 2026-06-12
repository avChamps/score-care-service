const { pool } = require("../config/db");

function mapGeneralSettings(row) {
  return {
    website: row?.website || "",
    email: row?.email || "",
    mobileNumber: row?.mobileNumber || "",
    whatsappNumber: row?.whatsappNumber || "",
    updatedAt: row?.updatedAt
  };
}

async function getGeneralSettings() {
  const [rows] = await pool.query(
    `SELECT
      website,
      email,
      mobile_number AS mobileNumber,
      whatsapp_number AS whatsappNumber,
      updated_at AS updatedAt
    FROM general_settings
    WHERE id = 1`
  );

  return mapGeneralSettings(rows[0]);
}

async function updateGeneralSettings(values) {
  await pool.query(
    `INSERT INTO general_settings (
      id,
      website,
      email,
      mobile_number,
      whatsapp_number
    )
    VALUES (1, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      website = VALUES(website),
      email = VALUES(email),
      mobile_number = VALUES(mobile_number),
      whatsapp_number = VALUES(whatsapp_number),
      updated_at = NOW()`,
    [
      values.website,
      values.email,
      values.mobileNumber,
      values.whatsappNumber
    ]
  );

  return getGeneralSettings();
}

module.exports = {
  getGeneralSettings,
  updateGeneralSettings
};
