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
    title: "CIBIL dispute raised",
    message: "Your CIBIL dispute request has been submitted.",
    notificationKey: `cibil_repair_request_created:${request.id}`,
    data: {
      repairRequestId: request.id,
      repairStatus: request.repairStatus,
      activeDisputes: request.activeDisputes,
      resolvedDisputes: request.resolvedDisputes
    }
  });
}

async function createCibilRepairRequestUpdatedNotification(userId, request) {
  return createNotification(userId, {
    type: "cibil_repair_request_updated",
    title: "CIBIL dispute updated",
    message: "Your CIBIL dispute request has been updated.",
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
    affectedRows: result.affectedRows
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
  createFeedbackSubmittedNotification,
  createFreeTierCreatedNotification,
  createLoanAppliedNotification,
  createLoanStatusUpdatedNotification,
  createMonthlyCibilReportNotifications,
  createNotification,
  listNotificationsByUserPublicId,
  markAllNotificationsReadByUserPublicId,
  markNotificationReadByUserPublicId
};
