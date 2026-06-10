const { pool } = require("../config/db");

async function getDashboardCounts() {
  const [[userCounts], [messageCounts], [loanCounts]] = await Promise.all([
    pool.query(
      `SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS newUsers,
        SUM(CASE
          WHEN subscription_status = 'active'
            AND (subscription_due_at IS NULL OR subscription_due_at >= NOW())
          THEN 1 ELSE 0
        END) AS subscriptions,
        SUM(CASE
          WHEN subscription_status = 'active'
            AND subscription_due_at > NOW()
            AND subscription_due_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
          THEN 1 ELSE 0
        END) AS upcomingOverdues
      FROM users`
    ),
    pool.query("SELECT COUNT(*) AS totalMessages FROM ai_prompt_messages"),
    pool.query(
      `SELECT
        COUNT(*) AS applied,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status IN ('submitted', 'in_review') THEN 1 ELSE 0 END) AS pending
      FROM loan_applications`
    )
  ]);

  return {
    totalUsers: Number(userCounts[0]?.totalUsers || 0),
    newUsers: Number(userCounts[0]?.newUsers || 0),
    subscriptions: Number(userCounts[0]?.subscriptions || 0),
    amount: 0,
    upcomingOverdues: Number(userCounts[0]?.upcomingOverdues || 0),
    totalMessages: Number(messageCounts[0]?.totalMessages || 0),
    loans: {
      applied: Number(loanCounts[0]?.applied || 0),
      approved: Number(loanCounts[0]?.approved || 0),
      rejected: Number(loanCounts[0]?.rejected || 0),
      pending: Number(loanCounts[0]?.pending || 0)
    }
  };
}

function mapAdminUser(row) {
  return {
    id: row.publicId,
    publicId: row.publicId,
    fullName: row.fullName,
    mobileNumber: row.mobileNumber,
    panNumber: row.panNumber,
    email: row.email,
    dateOfBirth: row.dateOfBirth,
    isAdmin: Boolean(row.isAdmin),
    status: row.status,
    accessType: row.accessType,
    subscriptionStatus: row.subscriptionStatus,
    subscriptionStartedAt: row.subscriptionStartedAt,
    subscriptionDueAt: row.subscriptionDueAt,
    subscriptionEndsAt: row.subscriptionEndsAt,
    creditScore: row.creditScore,
    creditScoreLastCheckedAt: row.creditScoreLastCheckedAt,
    totalMessages: Number(row.totalMessages || 0),
    loans: {
      total: Number(row.totalLoans || 0),
      latestStatus: row.latestLoanStatus,
      latestAppliedAt: row.latestLoanAppliedAt
    },
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function listAdminUsers(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const searchPattern = `%${search}%`;
  const where = search
    ? `WHERE (
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.pan_number LIKE ?
      OR u.email LIKE ?
    )`
    : "";
  const params = search
    ? [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    : [];

  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM users u
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        u.public_id AS publicId,
        u.full_name AS fullName,
        u.mobile_number AS mobileNumber,
        u.pan_number AS panNumber,
        u.email,
        u.date_of_birth AS dateOfBirth,
        u.is_admin AS isAdmin,
        u.status,
        CASE
          WHEN u.subscription_status = 'active'
            AND (u.subscription_due_at IS NULL OR u.subscription_due_at >= NOW())
          THEN 'paid'
          ELSE 'free'
        END AS accessType,
        u.subscription_status AS subscriptionStatus,
        u.subscription_started_at AS subscriptionStartedAt,
        u.subscription_due_at AS subscriptionDueAt,
        u.subscription_ends_at AS subscriptionEndsAt,
        cr.credit_score AS creditScore,
        cr.fetched_at AS creditScoreLastCheckedAt,
        COALESCE(messages.totalMessages, 0) AS totalMessages,
        COALESCE(loans.totalLoans, 0) AS totalLoans,
        latestLoan.status AS latestLoanStatus,
        latestLoan.created_at AS latestLoanAppliedAt,
        u.last_login_at AS lastLoginAt,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt
      FROM users u
      LEFT JOIN credit_reports cr
        ON cr.user_id = u.id
        AND cr.provider = 'surepass'
        AND cr.report_type = 'experian_score'
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS totalMessages
        FROM ai_prompt_messages
        GROUP BY user_id
      ) messages ON messages.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS totalLoans, MAX(id) AS latestLoanId
        FROM loan_applications
        GROUP BY user_id
      ) loans ON loans.user_id = u.id
      LEFT JOIN loan_applications latestLoan
        ON latestLoan.id = loans.latestLoanId
      ${where}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    users: rows.map(mapAdminUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function exportAdminUsers(options = {}) {
  const search = String(options.search || "").trim();
  const searchPattern = `%${search}%`;
  const where = search
    ? `WHERE (
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.pan_number LIKE ?
      OR u.email LIKE ?
    )`
    : "";
  const params = search
    ? [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    : [];
  const [rows] = await pool.query(
    `SELECT
      u.public_id AS publicId,
      u.full_name AS fullName,
      u.mobile_number AS mobileNumber,
      u.pan_number AS panNumber,
      u.email,
      u.date_of_birth AS dateOfBirth,
      u.is_admin AS isAdmin,
      u.status,
      CASE
        WHEN u.subscription_status = 'active'
          AND (u.subscription_due_at IS NULL OR u.subscription_due_at >= NOW())
        THEN 'paid'
        ELSE 'free'
      END AS accessType,
      u.subscription_status AS subscriptionStatus,
      u.subscription_started_at AS subscriptionStartedAt,
      u.subscription_due_at AS subscriptionDueAt,
      u.subscription_ends_at AS subscriptionEndsAt,
      cr.credit_score AS creditScore,
      cr.fetched_at AS creditScoreLastCheckedAt,
      COALESCE(messages.totalMessages, 0) AS totalMessages,
      COALESCE(loans.totalLoans, 0) AS totalLoans,
      latestLoan.status AS latestLoanStatus,
      latestLoan.created_at AS latestLoanAppliedAt,
      u.last_login_at AS lastLoginAt,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt
    FROM users u
    LEFT JOIN credit_reports cr
      ON cr.user_id = u.id
      AND cr.provider = 'surepass'
      AND cr.report_type = 'experian_score'
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS totalMessages
      FROM ai_prompt_messages
      GROUP BY user_id
    ) messages ON messages.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS totalLoans, MAX(id) AS latestLoanId
      FROM loan_applications
      GROUP BY user_id
    ) loans ON loans.user_id = u.id
    LEFT JOIN loan_applications latestLoan
      ON latestLoan.id = loans.latestLoanId
    ${where}
    ORDER BY u.created_at DESC, u.id DESC`,
    params
  );

  return rows.map(mapAdminUser);
}

async function updateUserSubscriptionByPublicId(publicId, subscription) {
  const [result] = await pool.query(
    `UPDATE users
    SET
      subscription_status = ?,
      subscription_started_at = ?,
      subscription_due_at = ?,
      subscription_ends_at = ?,
      updated_at = NOW()
    WHERE public_id = ?`,
    [
      subscription.subscriptionStatus,
      subscription.subscriptionStartedAt,
      subscription.subscriptionDueAt,
      subscription.subscriptionEndsAt,
      publicId
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT
      u.public_id AS publicId,
      u.full_name AS fullName,
      u.mobile_number AS mobileNumber,
      u.pan_number AS panNumber,
      u.email,
      u.date_of_birth AS dateOfBirth,
      u.is_admin AS isAdmin,
      u.status,
      CASE
        WHEN u.subscription_status = 'active'
          AND (u.subscription_due_at IS NULL OR u.subscription_due_at >= NOW())
        THEN 'paid'
        ELSE 'free'
      END AS accessType,
      u.subscription_status AS subscriptionStatus,
      u.subscription_started_at AS subscriptionStartedAt,
      u.subscription_due_at AS subscriptionDueAt,
      u.subscription_ends_at AS subscriptionEndsAt,
      NULL AS creditScore,
      NULL AS creditScoreLastCheckedAt,
      0 AS totalMessages,
      0 AS totalLoans,
      NULL AS latestLoanStatus,
      NULL AS latestLoanAppliedAt,
      u.last_login_at AS lastLoginAt,
      u.created_at AS createdAt,
      u.updated_at AS updatedAt
    FROM users u
    WHERE u.public_id = ?
    LIMIT 1`,
    [publicId]
  );

  return mapAdminUser(rows[0]);
}

module.exports = {
  exportAdminUsers,
  getDashboardCounts,
  listAdminUsers,
  updateUserSubscriptionByPublicId
};
