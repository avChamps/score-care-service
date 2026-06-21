const { pool } = require("../config/db");

async function getWebsiteSettings() {
  const [rows] = await pool.query(
    `SELECT
      privacy_policy AS privacyPolicy,
      terms_of_service AS termsOfService,
      disclaimer,
      updated_at AS updatedAt
    FROM website_settings
    WHERE id = 1`
  );

  return {
    privacyPolicy: rows[0]?.privacyPolicy || "",
    termsOfService: rows[0]?.termsOfService || "",
    disclaimer: rows[0]?.disclaimer || "",
    updatedAt: rows[0]?.updatedAt
  };
}

module.exports = {
  getWebsiteSettings
};
