const { randomUUID } = require("crypto");

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

function mapAdminNotification(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    userId: row.userPublicId,
    userPublicId: row.userPublicId,
    userName: row.userName,
    type: row.type,
    title: row.title,
    message: row.message,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    data: parseJson(row.data),
    isRead: Boolean(row.readAt),
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function adminNotificationSelect() {
  return `SELECT
    public_id AS publicId,
    user_public_id AS userPublicId,
    user_name AS userName,
    type,
    title,
    message,
    amount,
    currency,
    reference_type AS referenceType,
    reference_id AS referenceId,
    data,
    read_at AS readAt,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM admin_notifications`;
}

async function createAdminNotification(user, notification) {
  const publicId = randomUUID();

  await pool.query(
    `INSERT INTO admin_notifications (
      public_id,
      user_id,
      user_public_id,
      user_name,
      type,
      title,
      message,
      amount,
      currency,
      reference_type,
      reference_id,
      notification_key,
      data
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      updated_at = updated_at`,
    [
      publicId,
      user.internalId,
      user.publicId,
      user.fullName || user.mobileNumber || "User",
      notification.type,
      notification.title,
      notification.message,
      notification.amount ?? null,
      notification.currency || null,
      notification.referenceType,
      String(notification.referenceId),
      notification.notificationKey,
      notification.data ? JSON.stringify(notification.data) : null
    ]
  );

  const [rows] = await pool.query(
    `${adminNotificationSelect()}
    WHERE notification_key = ?
    LIMIT 1`,
    [notification.notificationKey]
  );

  return mapAdminNotification(rows[0]);
}

async function createAdminDisputeRaisedNotification(user, dispute) {
  const userName = user.fullName || user.mobileNumber || "User";

  return createAdminNotification(user, {
    type: "dispute_raised",
    title: "New dispute raised",
    message: `${userName} raised a dispute for ${dispute.lenderName || "a credit account"}.`,
    referenceType: "credit_dispute",
    referenceId: dispute.publicId,
    notificationKey: `dispute_raised:${dispute.publicId}`,
    data: {
      disputeId: dispute.publicId,
      lenderName: dispute.lenderName,
      accountNumber: dispute.accountNumber,
      errorType: dispute.errorType,
      status: dispute.status
    }
  });
}

async function createAdminCreditRepairNotification(user, request) {
  const userName = user.fullName || user.mobileNumber || "User";

  return createAdminNotification(user, {
    type: "credit_repair_purchased",
    title: "New credit repair request",
    message: `${userName} purchased ${request.planName} credit repair for ${request.currency} ${request.amount}.`,
    amount: request.amount,
    currency: request.currency,
    referenceType: "cibil_repair_request",
    referenceId: request.publicId,
    notificationKey: `credit_repair_purchased:${request.publicId}`,
    data: {
      repairRequestId: request.publicId,
      planName: request.planName,
      paymentStatus: request.paymentStatus,
      repairStatus: request.repairStatus
    }
  });
}

async function createAdminSubscriptionNotification(user, payment) {
  const userName = user.fullName || user.mobileNumber || "User";

  return createAdminNotification(user, {
    type: "subscription_purchased",
    title: "New subscription",
    message: `${userName} subscribed for ${payment.currency} ${payment.amount}.`,
    amount: payment.amount,
    currency: payment.currency,
    referenceType: "subscription_payment",
    referenceId: payment.paymentId,
    notificationKey: `subscription_purchased:${payment.paymentId}`,
    data: {
      paymentId: payment.paymentId,
      planPublicId: payment.planPublicId
    }
  });
}

async function listAdminNotifications(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  const type = String(options.type || "").trim();
  const search = String(options.search || "").trim();

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  if (String(options.unreadOnly) === "true" || String(options.unreadOnly) === "1") {
    conditions.push("read_at IS NULL");
  }

  if (search) {
    conditions.push("(user_name LIKE ? OR title LIKE ? OR message LIKE ?)");
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[rows], [countRows], [unreadRows]] = await Promise.all([
    pool.query(
      `${adminNotificationSelect()}
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*) AS total
      FROM admin_notifications
      ${whereClause}`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) AS unreadCount
      FROM admin_notifications
      WHERE read_at IS NULL`
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    notifications: rows.map(mapAdminNotification),
    unreadCount: Number(unreadRows[0]?.unreadCount || 0),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function markAdminNotificationRead(publicId) {
  const [result] = await pool.query(
    `UPDATE admin_notifications
    SET read_at = COALESCE(read_at, NOW()),
      updated_at = NOW()
    WHERE public_id = ?`,
    [publicId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `${adminNotificationSelect()}
    WHERE public_id = ?
    LIMIT 1`,
    [publicId]
  );

  return mapAdminNotification(rows[0]);
}

async function markAllAdminNotificationsRead() {
  const [result] = await pool.query(
    `UPDATE admin_notifications
    SET read_at = NOW(),
      updated_at = NOW()
    WHERE read_at IS NULL`
  );

  return result.affectedRows;
}

module.exports = {
  createAdminCreditRepairNotification,
  createAdminDisputeRaisedNotification,
  createAdminSubscriptionNotification,
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead
};
