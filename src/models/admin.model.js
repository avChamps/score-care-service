const { pool } = require("../config/db");

async function getDashboardCounts() {
  const toPercentage = (count, total) =>
    total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
  const mapCountRows = (rows, total) =>
    rows.map((row) => {
      const count = Number(row.count || 0);

      return {
        label: row.label,
        count,
        percentage: toPercentage(count, total)
      };
    });
  const [
    [userCounts],
    [messageCounts],
    [feedbackCounts],
    [feedbackRatingRows],
    [loanCounts],
    [paymentCounts],
    [userStatusRows],
    [accessTypeRows],
    [subscriptionStatusRows],
    [loanStatusRows],
    [monthlyRows]
  ] = await Promise.all([
    pool.query(
      `SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS newUsers,
        SUM(CASE
          WHEN subscription_status IN ('active', 'cancelled')
            AND (subscription_due_at IS NULL OR subscription_due_at >= NOW())
          THEN 1 ELSE 0
        END) AS subscriptions,
        SUM(CASE
          WHEN subscription_status IN ('active', 'cancelled')
            AND subscription_due_at > NOW()
            AND subscription_due_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)
          THEN 1 ELSE 0
        END) AS upcomingOverdues
      FROM users`
    ),
    pool.query("SELECT COUNT(*) AS totalMessages FROM ai_prompt_messages"),
    pool.query("SELECT COUNT(*) AS totalFeedback FROM feedback"),
    pool.query(
      `SELECT rating AS label, COUNT(*) AS count
      FROM feedback
      WHERE rating IS NOT NULL
      GROUP BY rating
      ORDER BY rating DESC`
    ),
    pool.query(
      `SELECT
        COUNT(*) AS applied,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status IN ('submitted', 'in_review') THEN 1 ELSE 0 END) AS pending
      FROM loan_applications`
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount
      FROM subscription_payments
      WHERE payment_status = 'paid'`
    ),
    pool.query(
      `SELECT status AS label, COUNT(*) AS count
      FROM users
      GROUP BY status`
    ),
    pool.query(
      `SELECT
        CASE
          WHEN subscription_status IN ('active', 'cancelled')
            AND (subscription_due_at IS NULL OR subscription_due_at >= NOW())
          THEN 'paid'
          ELSE 'free'
        END AS label,
        COUNT(*) AS count
      FROM users
      GROUP BY label`
    ),
    pool.query(
      `SELECT subscription_status AS label, COUNT(*) AS count
      FROM users
      GROUP BY subscription_status`
    ),
    pool.query(
      `SELECT status AS label, COUNT(*) AS count
      FROM loan_applications
      GROUP BY status`
    ),
    pool.query(
      `SELECT
        DATE_FORMAT(months.monthStart, '%Y-%m') AS label,
        COALESCE(users.count, 0) AS users,
        COALESCE(messages.count, 0) AS messages,
        COALESCE(loans.count, 0) AS loans
      FROM (
        SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 11 MONTH, '%Y-%m-01') AS monthStart
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 10 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 9 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 8 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 7 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 6 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 5 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 4 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 3 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 2 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE - INTERVAL 1 MONTH, '%Y-%m-01')
        UNION ALL SELECT DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
      ) months
      LEFT JOIN (
        SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS monthStart, COUNT(*) AS count
        FROM users
        WHERE created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 11 MONTH, '%Y-%m-01')
        GROUP BY monthStart
      ) users ON users.monthStart = months.monthStart
      LEFT JOIN (
        SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS monthStart, COUNT(*) AS count
        FROM ai_prompt_messages
        WHERE created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 11 MONTH, '%Y-%m-01')
        GROUP BY monthStart
      ) messages ON messages.monthStart = months.monthStart
      LEFT JOIN (
        SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS monthStart, COUNT(*) AS count
        FROM loan_applications
        WHERE created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 11 MONTH, '%Y-%m-01')
        GROUP BY monthStart
      ) loans ON loans.monthStart = months.monthStart
      ORDER BY months.monthStart`
    )
  ]);
  const totalUsers = Number(userCounts[0]?.totalUsers || 0);
  const totalMessages = Number(messageCounts[0]?.totalMessages || 0);
  const totalFeedback = Number(feedbackCounts[0]?.totalFeedback || 0);
  const totalLoans = Number(loanCounts[0]?.applied || 0);

  return {
    totalUsers,
    newUsers: Number(userCounts[0]?.newUsers || 0),
    subscriptions: Number(userCounts[0]?.subscriptions || 0),
    amount: Number(paymentCounts[0]?.amount || 0),
    upcomingOverdues: Number(userCounts[0]?.upcomingOverdues || 0),
    totalMessages,
    totalFeedback,
    loans: {
      applied: totalLoans,
      approved: Number(loanCounts[0]?.approved || 0),
      rejected: Number(loanCounts[0]?.rejected || 0),
      pending: Number(loanCounts[0]?.pending || 0)
    },
    graphs: {
      usersByStatus: mapCountRows(userStatusRows, totalUsers),
      usersByAccessType: mapCountRows(accessTypeRows, totalUsers),
      subscriptionsByStatus: mapCountRows(subscriptionStatusRows, totalUsers),
      feedbackByRating: mapCountRows(feedbackRatingRows, totalFeedback),
      loansByStatus: mapCountRows(loanStatusRows, totalLoans),
      monthlyRecords: monthlyRows.map((row) => ({
        label: row.label,
        users: Number(row.users || 0),
        messages: Number(row.messages || 0),
        loans: Number(row.loans || 0)
      }))
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
    subscriptionAmount: Number(row.subscriptionAmount || 0),
    latestSubscriptionAmount: Number(row.latestSubscriptionAmount || 0),
    planUpdatedByUserName: row.planUpdatedByFullName,
    planUpdatedBy: row.planUpdatedById
      ? {
          id: row.planUpdatedById,
          fullName: row.planUpdatedByFullName,
          mobileNumber: row.planUpdatedByMobileNumber
        }
      : null,
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

function buildAdminUsersWhere(options = {}) {
  const search = String(options.search || "").trim();
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.pan_number LIKE ?
      OR u.email LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (from) {
    conditions.push("u.created_at >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("u.created_at <= ?");
    params.push(totime);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

async function listAdminUsers(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const { where, params } = buildAdminUsersWhere(options);

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
          WHEN u.subscription_status IN ('active', 'cancelled')
            AND (u.subscription_due_at IS NULL OR u.subscription_due_at >= NOW())
          THEN 'paid'
          ELSE 'free'
        END AS accessType,
        u.subscription_status AS subscriptionStatus,
        COALESCE(payments.subscriptionAmount, 0) AS subscriptionAmount,
        latestPayment.amount AS latestSubscriptionAmount,
        planUpdatedBy.public_id AS planUpdatedById,
        planUpdatedBy.full_name AS planUpdatedByFullName,
        planUpdatedBy.mobile_number AS planUpdatedByMobileNumber,
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
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS subscriptionAmount, MAX(id) AS latestPaymentId
        FROM subscription_payments
        WHERE payment_status = 'paid'
        GROUP BY user_id
      ) payments ON payments.user_id = u.id
      LEFT JOIN subscription_payments latestPayment
        ON latestPayment.id = payments.latestPaymentId
      LEFT JOIN users planUpdatedBy
        ON planUpdatedBy.id = latestPayment.updated_by_user_id
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
  const { where, params } = buildAdminUsersWhere(options);
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
        WHEN u.subscription_status IN ('active', 'cancelled')
          AND (u.subscription_due_at IS NULL OR u.subscription_due_at >= NOW())
        THEN 'paid'
        ELSE 'free'
      END AS accessType,
      u.subscription_status AS subscriptionStatus,
      COALESCE(payments.subscriptionAmount, 0) AS subscriptionAmount,
      latestPayment.amount AS latestSubscriptionAmount,
      planUpdatedBy.public_id AS planUpdatedById,
      planUpdatedBy.full_name AS planUpdatedByFullName,
      planUpdatedBy.mobile_number AS planUpdatedByMobileNumber,
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
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS subscriptionAmount, MAX(id) AS latestPaymentId
      FROM subscription_payments
      WHERE payment_status = 'paid'
      GROUP BY user_id
    ) payments ON payments.user_id = u.id
    LEFT JOIN subscription_payments latestPayment
      ON latestPayment.id = payments.latestPaymentId
    LEFT JOIN users planUpdatedBy
      ON planUpdatedBy.id = latestPayment.updated_by_user_id
    ${where}
    ORDER BY u.created_at DESC, u.id DESC`,
    params
  );

  return rows.map(mapAdminUser);
}

function mapAdminLoan(row) {
  if (!row) {
    return null;
  }

  const documents =
    typeof row.documents === "string"
      ? JSON.parse(row.documents)
      : row.documents || {};

  return {
    id: row.id,
    internalUserId: row.internalUserId,
    userId: row.userPublicId,
    user: {
      id: row.userPublicId,
      fullName: row.fullName,
      mobileNumber: row.mobileNumber,
      panNumber: row.panNumber,
      email: row.email
    },
    loanAmount: Number(row.loanAmount),
    loanType: row.loanType,
    employmentType: row.employmentType,
    monthlyIncome: Number(row.monthlyIncome),
    workExperience: row.workExperience,
    status: row.status,
    remarks: row.remarks,
    updatedBy: row.updatedById
      ? {
          id: row.updatedById,
          fullName: row.updatedByFullName,
          mobileNumber: row.updatedByMobileNumber
        }
      : null,
    documents,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function listAdminLoans(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const { where, params } = buildAdminLoansWhere(options);

  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM loan_applications la
      INNER JOIN users u ON u.id = la.user_id
      ${where}`,
      params
    ),
    pool.query(
      `${getAdminLoansSelectQuery()}
      ${where}
      ORDER BY la.created_at DESC, la.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    loans: rows.map(mapAdminLoan),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

function buildAdminLoansWhere(options = {}) {
  const search = String(options.search || "").trim();
  const status = String(options.status || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      la.user_public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.pan_number LIKE ?
      OR u.email LIKE ?
      OR la.loan_type LIKE ?
    )`);
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  if (status) {
    conditions.push("la.status = ?");
    params.push(status);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

function getAdminLoansSelectQuery() {
  return `SELECT
    la.id,
    la.user_id AS internalUserId,
    la.user_public_id AS userPublicId,
    u.full_name AS fullName,
    u.mobile_number AS mobileNumber,
    u.pan_number AS panNumber,
    u.email,
    la.loan_amount AS loanAmount,
    la.loan_type AS loanType,
    la.employment_type AS employmentType,
    la.monthly_income AS monthlyIncome,
    la.work_experience AS workExperience,
    la.documents,
    la.status,
    la.remarks,
    updatedBy.public_id AS updatedById,
    updatedBy.full_name AS updatedByFullName,
    updatedBy.mobile_number AS updatedByMobileNumber,
    la.created_at AS createdAt,
    la.updated_at AS updatedAt
  FROM loan_applications la
  INNER JOIN users u ON u.id = la.user_id
  LEFT JOIN users updatedBy ON updatedBy.id = la.updated_by_user_id`;
}

async function exportAdminLoans(options = {}) {
  const { where, params } = buildAdminLoansWhere(options);
  const [rows] = await pool.query(
    `${getAdminLoansSelectQuery()}
    ${where}
    ORDER BY la.created_at DESC, la.id DESC`,
    params
  );

  return rows.map(mapAdminLoan);
}

function mapAdminChatUser(row, questions = []) {
  return {
    userId: row.userPublicId,
    fullName: row.fullName,
    mobileNumber: row.mobileNumber,
    panNumber: row.panNumber,
    email: row.email,
    totalChats: Number(row.totalChats || 0),
    latestChatAt: row.latestChatAt,
    questions
  };
}

function mapAdminChatQuestion(row) {
  return {
    id: row.id,
    question: row.message,
    createdAt: row.createdAt
  };
}

async function listAdminChats(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const messageLimit = Math.min(Math.max(Number(options.messageLimit) || 5, 1), 50);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const conditions = ["messages.totalChats > 0"];
  const params = [];

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.pan_number LIKE ?
      OR u.email LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [[countRows], [users]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM users u
      INNER JOIN (
        SELECT user_id, COUNT(*) AS totalChats, MAX(created_at) AS latestChatAt
        FROM ai_prompt_messages
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) messages ON messages.user_id = u.id
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        u.id AS internalUserId,
        u.public_id AS userPublicId,
        u.full_name AS fullName,
        u.mobile_number AS mobileNumber,
        u.pan_number AS panNumber,
        u.email,
        messages.totalChats,
        messages.latestChatAt
      FROM users u
      INNER JOIN (
        SELECT user_id, COUNT(*) AS totalChats, MAX(created_at) AS latestChatAt
        FROM ai_prompt_messages
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) messages ON messages.user_id = u.id
      ${where}
      ORDER BY messages.latestChatAt DESC, u.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);

  const chatUsers = await Promise.all(
    users.map(async (user) => {
      const [messages] = await pool.query(
        `SELECT
          id,
          message,
          created_at AS createdAt
        FROM ai_prompt_messages
        WHERE user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
        [user.internalUserId, messageLimit]
      );

      return mapAdminChatUser(user, messages.map(mapAdminChatQuestion));
    })
  );
  const total = Number(countRows[0]?.total || 0);

  return {
    users: chatUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function findAdminLoanById(id) {
  const [rows] = await pool.query(
    `SELECT
      la.id,
      la.user_id AS internalUserId,
      la.user_public_id AS userPublicId,
      u.full_name AS fullName,
      u.mobile_number AS mobileNumber,
      u.pan_number AS panNumber,
      u.email,
      la.loan_amount AS loanAmount,
      la.loan_type AS loanType,
      la.employment_type AS employmentType,
      la.monthly_income AS monthlyIncome,
      la.work_experience AS workExperience,
      la.documents,
      la.status,
      la.remarks,
      updatedBy.public_id AS updatedById,
      updatedBy.full_name AS updatedByFullName,
      updatedBy.mobile_number AS updatedByMobileNumber,
      la.created_at AS createdAt,
      la.updated_at AS updatedAt
    FROM loan_applications la
    INNER JOIN users u ON u.id = la.user_id
    LEFT JOIN users updatedBy ON updatedBy.id = la.updated_by_user_id
    WHERE la.id = ?
    LIMIT 1`,
    [id]
  );

  return mapAdminLoan(rows[0]);
}

async function updateAdminLoanById(id, loanUpdate) {
  const [result] = await pool.query(
    `UPDATE loan_applications
    SET
      status = ?,
      remarks = ?,
      updated_by_user_id = ?,
      updated_at = NOW()
    WHERE id = ?`,
    [
      loanUpdate.status,
      loanUpdate.remarks,
      loanUpdate.updatedByUserId,
      id
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findAdminLoanById(id);
}

async function updateUserSubscriptionByPublicId(publicId, subscription) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT id FROM users WHERE public_id = ? LIMIT 1 FOR UPDATE",
      [publicId]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      return null;
    }

    const userId = userRows[0].id;

    await connection.query(
      `UPDATE users
      SET
        subscription_status = ?,
        subscription_started_at = ?,
        subscription_due_at = ?,
        subscription_ends_at = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        subscription.subscriptionStatus,
        subscription.subscriptionStartedAt,
        subscription.subscriptionDueAt,
        subscription.subscriptionEndsAt,
        userId
      ]
    );

    if (subscription.amount !== null) {
      await connection.query(
        `INSERT INTO subscription_payments (user_id, amount, payment_status, updated_by_user_id)
        VALUES (?, ?, 'paid', ?)`,
        [userId, subscription.amount, subscription.updatedByUserId]
      );
    }

    const [rows] = await connection.query(
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
          WHEN u.subscription_status IN ('active', 'cancelled')
            AND (u.subscription_due_at IS NULL OR u.subscription_due_at >= NOW())
          THEN 'paid'
          ELSE 'free'
        END AS accessType,
        u.subscription_status AS subscriptionStatus,
        COALESCE(payments.subscriptionAmount, 0) AS subscriptionAmount,
        latestPayment.amount AS latestSubscriptionAmount,
        planUpdatedBy.public_id AS planUpdatedById,
        planUpdatedBy.full_name AS planUpdatedByFullName,
        planUpdatedBy.mobile_number AS planUpdatedByMobileNumber,
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
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS subscriptionAmount, MAX(id) AS latestPaymentId
        FROM subscription_payments
        WHERE payment_status = 'paid'
        GROUP BY user_id
      ) payments ON payments.user_id = u.id
      LEFT JOIN subscription_payments latestPayment
        ON latestPayment.id = payments.latestPaymentId
      LEFT JOIN users planUpdatedBy
        ON planUpdatedBy.id = latestPayment.updated_by_user_id
      WHERE u.id = ?
      LIMIT 1`,
      [userId]
    );

    await connection.commit();

    return mapAdminUser(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  exportAdminLoans,
  exportAdminUsers,
  findAdminLoanById,
  getDashboardCounts,
  listAdminChats,
  listAdminLoans,
  listAdminUsers,
  updateAdminLoanById,
  updateUserSubscriptionByPublicId
};
