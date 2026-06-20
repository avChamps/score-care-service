const { pool } = require("../config/db");

function mapLegalContent(row) {
  return {
    id: row?.id,
    termsAndConditions: row?.termsAndConditions || "",
    privacyPolicy: row?.privacyPolicy || "",
    consent: row?.consent || "",
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt
  };
}

async function getLegalContent() {
  const [rows] = await pool.query(
    `SELECT
      id,
      terms_and_conditions AS termsAndConditions,
      privacy_policy AS privacyPolicy,
      consent,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM legal_contents
    WHERE id = 1`
  );

  return mapLegalContent(rows[0]);
}

async function updateLegalContent(values) {
  await pool.query(
    `INSERT INTO legal_contents (
      id,
      terms_and_conditions,
      privacy_policy,
      consent
    )
    VALUES (1, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      terms_and_conditions = VALUES(terms_and_conditions),
      privacy_policy = VALUES(privacy_policy),
      consent = VALUES(consent),
      updated_at = NOW()`,
    [
      values.termsAndConditions,
      values.privacyPolicy,
      values.consent
    ]
  );

  return getLegalContent();
}

module.exports = {
  getLegalContent,
  updateLegalContent
};
