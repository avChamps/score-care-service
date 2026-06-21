const { pool } = require("../config/db");

function mapGeneralSettings(row) {
  return {
    website: row?.website || "",
    email: row?.email || "",
    mobileNumber: row?.mobileNumber || "",
    whatsappNumber: row?.whatsappNumber || "",
    selectedLanguage: row?.selectedLanguage || "English",
    address: row?.address || "",
    prompt_message: row?.promptMessage || "",
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
      selected_language AS selectedLanguage,
      address,
      prompt_message AS promptMessage,
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
      whatsapp_number,
      selected_language,
      address
    )
    VALUES (1, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      website = VALUES(website),
      email = VALUES(email),
      mobile_number = VALUES(mobile_number),
      whatsapp_number = VALUES(whatsapp_number),
      selected_language = VALUES(selected_language),
      address = VALUES(address),
      updated_at = NOW()`,
    [
      values.website,
      values.email,
      values.mobileNumber,
      values.whatsappNumber,
      values.selectedLanguage,
      values.address
    ]
  );

  return getGeneralSettings();
}

module.exports = {
  getGeneralSettings,
  updateGeneralSettings
};
