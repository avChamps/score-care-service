const { randomUUID } = require("crypto");
const { pool } = require("../config/db");

function mapNotificationLog(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    publicId: row.publicId,
    userId: row.userId,
    notificationType: row.notificationType,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    recipientMobile: row.recipientMobile,
    message: row.message,
    status: row.status,
    providerResponse: row.providerResponse,
    scheduledFor: row.scheduledFor,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function createPendingNotificationLog(log) {
  const publicId = randomUUID();
  const [result] = await pool.query(
    `INSERT IGNORE INTO notification_logs (
      public_id,
      user_id,
      notification_type,
      reference_type,
      reference_id,
      recipient_mobile,
      message,
      status,
      scheduled_for
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      publicId,
      log.userId,
      log.notificationType,
      log.referenceType,
      String(log.referenceId),
      log.recipientMobile,
      log.message,
      log.scheduledFor
    ]
  );

  if (!result.insertId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT
      id,
      public_id AS publicId,
      user_id AS userId,
      notification_type AS notificationType,
      reference_type AS referenceType,
      reference_id AS referenceId,
      recipient_mobile AS recipientMobile,
      message,
      status,
      provider_response AS providerResponse,
      scheduled_for AS scheduledFor,
      sent_at AS sentAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM notification_logs
    WHERE id = ?`,
    [result.insertId]
  );

  return mapNotificationLog(rows[0]);
}

async function updateNotificationLogStatus(id, status, providerResponse) {
  await pool.query(
    `UPDATE notification_logs
    SET
      status = ?,
      provider_response = ?,
      sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END,
      updated_at = NOW()
    WHERE id = ?`,
    [
      status,
      providerResponse ? JSON.stringify(providerResponse) : null,
      status,
      id
    ]
  );
}

module.exports = {
  createPendingNotificationLog,
  updateNotificationLogStatus
};
