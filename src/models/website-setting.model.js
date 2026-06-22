const { pool } = require("../config/db");

async function getWebsiteSettings() {
  const [rows] = await pool.query(
    `SELECT
      privacy_policy AS privacyPolicy,
      terms_of_service AS termsOfService,
      disclaimer,
      account_deletion AS accountDeletion,
      updated_at AS updatedAt
    FROM website_settings
    WHERE id = 1`
  );

  return {
    privacyPolicy: rows[0]?.privacyPolicy || "",
    termsOfService: rows[0]?.termsOfService || "",
    disclaimer: rows[0]?.disclaimer || "",
    accountDeletion: rows[0]?.accountDeletion || "",
    updatedAt: rows[0]?.updatedAt
  };
}

async function updateWebsiteSettings(values) {
  await pool.query(
    `INSERT INTO website_settings (
      id,
      privacy_policy,
      terms_of_service,
      disclaimer,
      account_deletion
    )
    VALUES (1, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      privacy_policy = VALUES(privacy_policy),
      terms_of_service = VALUES(terms_of_service),
      disclaimer = VALUES(disclaimer),
      account_deletion = VALUES(account_deletion),
      updated_at = NOW()`,
    [
      values.privacyPolicy,
      values.termsOfService,
      values.disclaimer,
      values.accountDeletion
    ]
  );

  return getWebsiteSettings();
}

module.exports = {
  getWebsiteSettings,
  updateWebsiteSettings
};
