const { pool } = require("../config/db");

function parseJson(value) {
  if (!value || typeof value !== "string") {
    return value || null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function mapNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userPublicId,
    userPublicId: row.userPublicId,
    type: row.type,
    title: row.title,
    message: row.message,
    data: parseJson(row.data),
    isRead: Boolean(row.readAt),
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapUserFcmToken(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    fcmToken: row.fcmToken,
    platform: row.platform,
    deviceId: row.deviceId,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function upsertUserFcmToken(userId, token) {
  const [updateResult] = await pool.query(
    `UPDATE user_fcm_tokens
    SET
      user_id = ?,
      platform = ?,
      device_id = ?,
      is_active = 1,
      updated_at = NOW()
    WHERE fcm_token = ?`,
    [
      userId,
      token.platform || "android",
      token.deviceId || null,
      token.fcmToken
    ]
  );

  if (!updateResult.affectedRows) {
    const [insertResult] = await pool.query(
      `INSERT INTO user_fcm_tokens (
        user_id,
        fcm_token,
        platform,
        device_id
      )
      VALUES (?, ?, ?, ?)`,
      [
        userId,
        token.fcmToken,
        token.platform || "android",
        token.deviceId || null
      ]
    );

    return findUserFcmTokenById(insertResult.insertId);
  }

  return findUserFcmTokenByToken(token.fcmToken);
}

async function findUserFcmTokenById(id) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      fcm_token AS fcmToken,
      platform,
      device_id AS deviceId,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_fcm_tokens
    WHERE id = ?`,
    [id]
  );

  return mapUserFcmToken(rows[0]);
}

async function findUserFcmTokenByToken(fcmToken) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      fcm_token AS fcmToken,
      platform,
      device_id AS deviceId,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_fcm_tokens
    WHERE fcm_token = ?
    ORDER BY updated_at DESC, id DESC
    LIMIT 1`,
    [fcmToken]
  );

  return mapUserFcmToken(rows[0]);
}

async function listActiveFcmTokensByUserIds(userIds) {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];

  if (!ids.length) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      fcm_token AS fcmToken,
      platform,
      device_id AS deviceId,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_fcm_tokens
    WHERE is_active = 1
      AND user_id IN (?)`,
    [ids]
  );

  return rows.map(mapUserFcmToken);
}

async function listAllActiveFcmTokens() {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_id AS userId,
      fcm_token AS fcmToken,
      platform,
      device_id AS deviceId,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM user_fcm_tokens
    WHERE is_active = 1`
  );

  return rows.map(mapUserFcmToken);
}

async function disableFcmTokens(fcmTokens) {
  const tokens = [...new Set(fcmTokens.filter(Boolean))];

  if (!tokens.length) {
    return 0;
  }

  const [result] = await pool.query(
    `UPDATE user_fcm_tokens
    SET
      is_active = 0,
      updated_at = NOW()
    WHERE fcm_token IN (?)`,
    [tokens]
  );

  return result.affectedRows;
}

async function createNotification(userId, notification) {
  const [userRows] = await pool.query(
    "SELECT public_id AS publicId FROM users WHERE id = ?",
    [userId]
  );
  const userPublicId = userRows[0]?.publicId;

  if (!userPublicId) {
    const error = new Error("User public id is required");
    error.statusCode = 404;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO notifications (
      user_id,
      user_public_id,
      type,
      title,
      message,
      data,
      notification_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      updated_at = updated_at`,
    [
      userId,
      userPublicId,
      notification.type,
      notification.title,
      notification.message,
      notification.data ? JSON.stringify(notification.data) : null,
      notification.notificationKey || null
    ]
  );

  if (!result.insertId && notification.notificationKey) {
    return findNotificationByKeyForUserPublicId(
      userPublicId,
      notification.notificationKey
    );
  }

  return findNotificationByIdForUserPublicId(result.insertId, userPublicId);
}

async function createLoanAppliedNotification(userId, loanApplication) {
  return createNotification(userId, {
    type: "loan_applied",
    title: "Loan application submitted",
    message: `Your ${loanApplication.loanType} loan application for Rs. ${loanApplication.loanAmount} has been submitted.`,
    notificationKey: `loan_applied:${loanApplication.id}`,
    data: {
      loanApplicationId: loanApplication.id,
      loanAmount: loanApplication.loanAmount,
      loanType: loanApplication.loanType,
      status: loanApplication.status
    }
  });
}

async function createLoanStatusUpdatedNotification(userId, loanApplication) {
  return createNotification(userId, {
    type: "loan_status_updated",
    title: "Loan application updated",
    message: loanApplication.remarks
      ? `Your ${loanApplication.loanType} loan application status is ${loanApplication.status}. Remarks: ${loanApplication.remarks}`
      : `Your ${loanApplication.loanType} loan application status is ${loanApplication.status}.`,
    notificationKey: `loan_status_updated:${loanApplication.id}:${Date.now()}`,
    data: {
      loanApplicationId: loanApplication.id,
      loanAmount: loanApplication.loanAmount,
      loanType: loanApplication.loanType,
      status: loanApplication.status,
      remarks: loanApplication.remarks
    }
  });
}

async function createFeedbackSubmittedNotification(userId, feedback) {
  return createNotification(userId, {
    type: "feedback_submitted",
    title: "Feedback submitted",
    message: "Thank you for sharing your feedback.",
    notificationKey: `feedback_submitted:${feedback.id}`,
    data: {
      feedbackId: feedback.id,
      rating: feedback.rating,
      isLiked: feedback.isLiked,
      isDisliked: feedback.isDisliked
    }
  });
}

async function createFreeTierCreatedNotification(userId) {
  return createNotification(userId, {
    type: "free_tier_created",
    title: "Free tier activated",
    message: "Your free tier account is ready. Subscribe to unlock more benefits.",
    notificationKey: "free_tier_created",
    data: {
      accessType: "free"
    }
  });
}

async function createCibilRepairRequestCreatedNotification(userId, request) {
  return createNotification(userId, {
    type: "cibil_repair_request_created",
    title: "CIBIL repair request accepted",
    message: "Your request has been accepted. Please upload your documents.",
    notificationKey: `cibil_repair_request_created:${request.id}`,
    data: {
      repairRequestId: request.id,
      repairStatus: request.repairStatus,
      activeDisputes: request.activeDisputes,
      resolvedDisputes: request.resolvedDisputes
    }
  });
}

async function createCreditRepairDocumentsUploadedNotification(userId, request) {
  return createNotification(userId, {
    type: "credit_repair_documents_uploaded",
    title: "Documents uploaded",
    message: "Your documents have been uploaded successfully. We will review them soon.",
    notificationKey: `credit_repair_documents_uploaded:${request.id}:${Date.now()}`,
    data: {
      repairRequestId: request.id,
      repairStatus: request.repairStatus
    }
  });
}

async function createCreditDisputeSubmittedNotification(userId, dispute) {
  return createNotification(userId, {
    type: "credit_dispute_submitted",
    title: "Credit dispute raised",
    message: "Your credit dispute request has been submitted.",
    notificationKey: `credit_dispute_submitted:${dispute.publicId}`,
    data: {
      disputeId: dispute.publicId,
      status: dispute.status,
      lenderName: dispute.lenderName,
      errorType: dispute.errorType
    }
  });
}

async function createCibilRepairRequestUpdatedNotification(userId, request) {
  return createNotification(userId, {
    type: "cibil_repair_request_updated",
    title: "CIBIL dispute updated",
    message: `Your CIBIL dispute request status is ${request.repairStatus}.`,
    notificationKey: `cibil_repair_request_updated:${request.id}:${Date.now()}`,
    data: {
      repairRequestId: request.id,
      repairStatus: request.repairStatus,
      activeDisputes: request.activeDisputes,
      resolvedDisputes: request.resolvedDisputes,
      pointsGained: request.pointsGained,
      remarks: request.remarks
    }
  });
}

async function createMonthlyCibilReportNotifications(monthKey) {
  const [userRows] = await pool.query(
    `SELECT DISTINCT cr.user_id AS userId
    FROM credit_reports cr
    INNER JOIN users u ON u.id = cr.user_id
    WHERE cr.provider = 'surepass'
      AND cr.report_type = 'cibil_pdf'
      AND u.status = 'active'`
  );
  const [result] = await pool.query(
    `INSERT INTO notifications (
      user_id,
      user_public_id,
      type,
      title,
      message,
      data,
      notification_key
    )
    SELECT
      cr.user_id,
      cr.user_public_id,
      'cibil_report_updated',
      'CIBIL report updated',
      'Your monthly CIBIL report update is available.',
      JSON_OBJECT(
        'month', ?,
        'creditScore', cr.credit_score,
        'reportType', cr.report_type,
        'fetchedAt', cr.fetched_at
      ),
      CONCAT('cibil_report_updated:', ?, ':', cr.user_id)
    FROM credit_reports cr
    INNER JOIN users u ON u.id = cr.user_id
    WHERE cr.provider = 'surepass'
      AND cr.report_type = 'cibil_pdf'
      AND u.status = 'active'
    ON DUPLICATE KEY UPDATE
      updated_at = updated_at`,
    [monthKey, monthKey]
  );

  return {
    affectedRows: result.affectedRows,
    userIds: userRows.map((row) => row.userId)
  };
}

async function findNotificationByIdForUserPublicId(id, userPublicId) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_public_id AS userPublicId,
      type,
      title,
      message,
      data,
      read_at AS readAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM notifications
    WHERE id = ?
      AND user_public_id = ?`,
    [id, userPublicId]
  );

  return mapNotification(rows[0]);
}

async function findNotificationByKeyForUserPublicId(userPublicId, notificationKey) {
  const [rows] = await pool.query(
    `SELECT
      id,
      user_public_id AS userPublicId,
      type,
      title,
      message,
      data,
      read_at AS readAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM notifications
    WHERE user_public_id = ?
      AND notification_key = ?`,
    [userPublicId, notificationKey]
  );

  return mapNotification(rows[0]);
}

async function listNotificationsByUserPublicId(userPublicId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const unreadOnly =
    options.unreadOnly === true ||
    String(options.unreadOnly || "").toLowerCase() === "true";
  const where = unreadOnly
    ? "WHERE user_public_id = ? AND read_at IS NULL"
    : "WHERE user_public_id = ?";

  const [rows] = await pool.query(
    `SELECT
      id,
      user_public_id AS userPublicId,
      type,
      title,
      message,
      data,
      read_at AS readAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM notifications
    ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
    OFFSET ?`,
    [userPublicId, limit, offset]
  );

  return rows.map(mapNotification);
}

async function countUnreadNotificationsByUserPublicId(userPublicId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS unreadCount
    FROM notifications
    WHERE user_public_id = ?
      AND read_at IS NULL`,
    [userPublicId]
  );

  return Number(rows[0]?.unreadCount || 0);
}

async function markNotificationReadByUserPublicId(userPublicId, notificationId) {
  await pool.query(
    `UPDATE notifications
    SET
      read_at = COALESCE(read_at, NOW()),
      updated_at = NOW()
    WHERE id = ?
      AND user_public_id = ?`,
    [notificationId, userPublicId]
  );

  return findNotificationByIdForUserPublicId(notificationId, userPublicId);
}

async function markAllNotificationsReadByUserPublicId(userPublicId) {
  const [result] = await pool.query(
    `UPDATE notifications
    SET
      read_at = COALESCE(read_at, NOW()),
      updated_at = NOW()
    WHERE user_public_id = ?
      AND read_at IS NULL`,
    [userPublicId]
  );

  return result.affectedRows;
}

module.exports = {
  countUnreadNotificationsByUserPublicId,
  createCibilRepairRequestCreatedNotification,
  createCibilRepairRequestUpdatedNotification,
  createCreditDisputeSubmittedNotification,
  createCreditRepairDocumentsUploadedNotification,
  createFeedbackSubmittedNotification,
  createFreeTierCreatedNotification,
  createLoanAppliedNotification,
  createLoanStatusUpdatedNotification,
  createMonthlyCibilReportNotifications,
  createNotification,
  disableFcmTokens,
  listNotificationsByUserPublicId,
  listActiveFcmTokensByUserIds,
  listAllActiveFcmTokens,
  markAllNotificationsReadByUserPublicId,
  markNotificationReadByUserPublicId,
  upsertUserFcmToken
};
