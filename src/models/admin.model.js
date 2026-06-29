const { pool } = require("../config/db");

async function getDashboardCounts(options = {}) {
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const buildDateFilter = (column, baseConditions = []) => {
    const conditions = [...baseConditions];
    const params = [];

    if (from) {
      conditions.push(`${column} >= ?`);
      params.push(from);
    }

    if (totime) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(totime)) {
        conditions.push(`${column} < DATE_ADD(?, INTERVAL 1 DAY)`);
      } else {
        conditions.push(`${column} <= ?`);
      }
      params.push(totime);
    }

    return {
      where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      params
    };
  };
  const filters = {
    users: buildDateFilter("created_at"),
    messages: buildDateFilter("created_at"),
    feedback: buildDateFilter("created_at"),
    feedbackRatings: buildDateFilter("created_at", ["rating IS NOT NULL"]),
    loans: buildDateFilter("created_at"),
    subscriptionPayments: buildDateFilter("created_at", ["payment_status = 'paid'"]),
    repairPayments: buildDateFilter("created_at", ["payment_status = 'paid'"]),
    employees: buildDateFilter("created_at", ["deleted_at IS NULL"]),
    roles: buildDateFilter("created_at", ["deleted_at IS NULL"]),
    contacts: buildDateFilter("created_at"),
    creditReports: buildDateFilter("created_at"),
    repairRequests: buildDateFilter("created_at"),
    disputes: buildDateFilter("created_at"),
    documents: buildDateFilter("created_at"),
    notifications: buildDateFilter("created_at"),
    apiHits: buildDateFilter("created_at")
  };
  const monthlyFilter = buildDateFilter(
    "created_at",
    from || totime
      ? []
      : ["created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 11 MONTH, '%Y-%m-01')"]
  );
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
    [repairPaymentCounts],
    [employeeCounts],
    [roleCounts],
    [contactCounts],
    [creditReportCounts],
    [repairRequestCounts],
    [disputeCounts],
    [documentCounts],
    [notificationCounts],
    [apiHitCounts],
    [userStatusRows],
    [accessTypeRows],
    [subscriptionStatusRows],
    [loanStatusRows],
    [repairStatusRows],
    [disputeStatusRows],
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
      FROM users
      ${filters.users.where}`,
      filters.users.params
    ),
    pool.query(
      `SELECT COUNT(*) AS totalMessages
      FROM ai_prompt_messages
      ${filters.messages.where}`,
      filters.messages.params
    ),
    pool.query(
      `SELECT COUNT(*) AS totalFeedback
      FROM feedback
      ${filters.feedback.where}`,
      filters.feedback.params
    ),
    pool.query(
      `SELECT rating AS label, COUNT(*) AS count
      FROM feedback
      ${filters.feedbackRatings.where}
      GROUP BY rating
      ORDER BY rating DESC`,
      filters.feedbackRatings.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS applied,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status IN ('submitted', 'in_review') THEN 1 ELSE 0 END) AS pending
      FROM loan_applications
      ${filters.loans.where}`,
      filters.loans.params
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount
      FROM subscription_payments
      ${filters.subscriptionPayments.where}`,
      filters.subscriptionPayments.params
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount
      FROM cibil_repair_requests
      ${filters.repairPayments.where}`,
      filters.repairPayments.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS totalEmployees,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeEmployees,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactiveEmployees,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspendedEmployees
      FROM employees
      ${filters.employees.where}`,
      filters.employees.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS totalRoles,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeRoles,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactiveRoles
      FROM employee_roles
      ${filters.roles.where}`,
      filters.roles.params
    ),
    pool.query(
      `SELECT COUNT(*) AS totalContactRequests
      FROM contact_messages
      ${filters.contacts.where}`,
      filters.contacts.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS totalCreditReports,
        SUM(CASE WHEN credit_score IS NOT NULL AND credit_score <> '' THEN 1 ELSE 0 END) AS reportsWithScore
      FROM credit_reports
      ${filters.creditReports.where}`,
      filters.creditReports.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS totalRepairRequests,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paidRepairRequests,
        SUM(CASE WHEN repair_status IN ('upload_document', 'submitted', 'under_review', 'analysis', 'in_progress') THEN 1 ELSE 0 END) AS openRepairRequests,
        SUM(CASE WHEN repair_status IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS closedRepairRequests
      FROM cibil_repair_requests
      ${filters.repairRequests.where}`,
      filters.repairRequests.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS totalDisputes,
        SUM(CASE WHEN status IN ('submitted', 'under_review') THEN 1 ELSE 0 END) AS openDisputes,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolvedDisputes,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejectedDisputes
      FROM credit_disputes
      ${filters.disputes.where}`,
      filters.disputes.params
    ),
    pool.query(
      `SELECT COUNT(*) AS totalDocuments
      FROM credit_repair_documents
      ${filters.documents.where}`,
      filters.documents.params
    ),
    pool.query(
      `SELECT
        COUNT(*) AS totalNotifications,
        SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unreadNotifications
      FROM notifications
      ${filters.notifications.where}`,
      filters.notifications.params
    ),
    pool.query(
      `SELECT COUNT(*) AS totalApiHits
      FROM credit_bureau_api_hits
      ${filters.apiHits.where}`,
      filters.apiHits.params
    ),
    pool.query(
      `SELECT status AS label, COUNT(*) AS count
      FROM users
      ${filters.users.where}
      GROUP BY status`,
      filters.users.params
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
      ${filters.users.where}
      GROUP BY label`,
      filters.users.params
    ),
    pool.query(
      `SELECT subscription_status AS label, COUNT(*) AS count
      FROM users
      ${filters.users.where}
      GROUP BY subscription_status`,
      filters.users.params
    ),
    pool.query(
      `SELECT status AS label, COUNT(*) AS count
      FROM loan_applications
      ${filters.loans.where}
      GROUP BY status`,
      filters.loans.params
    ),
    pool.query(
      `SELECT repair_status AS label, COUNT(*) AS count
      FROM cibil_repair_requests
      ${filters.repairRequests.where}
      GROUP BY repair_status`,
      filters.repairRequests.params
    ),
    pool.query(
      `SELECT status AS label, COUNT(*) AS count
      FROM credit_disputes
      ${filters.disputes.where}
      GROUP BY status`,
      filters.disputes.params
    ),
    pool.query(
      `SELECT
        label,
        SUM(users) AS users,
        SUM(messages) AS messages,
        SUM(loans) AS loans
      FROM (
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS label,
          COUNT(*) AS users, 0 AS messages, 0 AS loans
        FROM users
        ${monthlyFilter.where}
        GROUP BY label
        UNION ALL
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS label,
          0 AS users, COUNT(*) AS messages, 0 AS loans
        FROM ai_prompt_messages
        ${monthlyFilter.where}
        GROUP BY label
        UNION ALL
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS label,
          0 AS users, 0 AS messages, COUNT(*) AS loans
        FROM loan_applications
        ${monthlyFilter.where}
        GROUP BY label
      ) monthly
      GROUP BY label
      ORDER BY label`,
      [
        ...monthlyFilter.params,
        ...monthlyFilter.params,
        ...monthlyFilter.params
      ]
    )
  ]);
  const totalUsers = Number(userCounts[0]?.totalUsers || 0);
  const totalMessages = Number(messageCounts[0]?.totalMessages || 0);
  const totalFeedback = Number(feedbackCounts[0]?.totalFeedback || 0);
  const totalLoans = Number(loanCounts[0]?.applied || 0);
  const subscriptionRevenue = Number(Number(paymentCounts[0]?.amount || 0).toFixed(2));
  const cibilRepairRevenue = Number(Number(repairPaymentCounts[0]?.amount || 0).toFixed(2));
  const totalRevenue = Number((subscriptionRevenue + cibilRepairRevenue).toFixed(2));
  const totalRepairRequests = Number(repairRequestCounts[0]?.totalRepairRequests || 0);
  const totalDisputes = Number(disputeCounts[0]?.totalDisputes || 0);

  return {
    filters: {
      from: from || null,
      totime: totime || null
    },
    totalUsers,
    newUsers: Number(userCounts[0]?.newUsers || 0),
    subscriptions: Number(userCounts[0]?.subscriptions || 0),
    amount: totalRevenue,
    revenue: {
      total: totalRevenue,
      subscriptions: subscriptionRevenue,
      cibilRepair: cibilRepairRevenue
    },
    upcomingOverdues: Number(userCounts[0]?.upcomingOverdues || 0),
    totalMessages,
    totalFeedback,
    totalContactRequests: Number(contactCounts[0]?.totalContactRequests || 0),
    totalCreditReports: Number(creditReportCounts[0]?.totalCreditReports || 0),
    reportsWithScore: Number(creditReportCounts[0]?.reportsWithScore || 0),
    totalDocuments: Number(documentCounts[0]?.totalDocuments || 0),
    totalNotifications: Number(notificationCounts[0]?.totalNotifications || 0),
    unreadNotifications: Number(notificationCounts[0]?.unreadNotifications || 0),
    apiHistoryCount: Number(apiHitCounts[0]?.totalApiHits || 0),
    employees: {
      total: Number(employeeCounts[0]?.totalEmployees || 0),
      active: Number(employeeCounts[0]?.activeEmployees || 0),
      inactive: Number(employeeCounts[0]?.inactiveEmployees || 0),
      suspended: Number(employeeCounts[0]?.suspendedEmployees || 0)
    },
    roles: {
      total: Number(roleCounts[0]?.totalRoles || 0),
      active: Number(roleCounts[0]?.activeRoles || 0),
      inactive: Number(roleCounts[0]?.inactiveRoles || 0)
    },
    loans: {
      applied: totalLoans,
      approved: Number(loanCounts[0]?.approved || 0),
      rejected: Number(loanCounts[0]?.rejected || 0),
      pending: Number(loanCounts[0]?.pending || 0)
    },
    cibilRepair: {
      total: totalRepairRequests,
      paid: Number(repairRequestCounts[0]?.paidRepairRequests || 0),
      open: Number(repairRequestCounts[0]?.openRepairRequests || 0),
      closed: Number(repairRequestCounts[0]?.closedRepairRequests || 0)
    },
    disputes: {
      total: totalDisputes,
      open: Number(disputeCounts[0]?.openDisputes || 0),
      resolved: Number(disputeCounts[0]?.resolvedDisputes || 0),
      rejected: Number(disputeCounts[0]?.rejectedDisputes || 0)
    },
    graphs: {
      usersByStatus: mapCountRows(userStatusRows, totalUsers),
      usersByAccessType: mapCountRows(accessTypeRows, totalUsers),
      subscriptionsByStatus: mapCountRows(subscriptionStatusRows, totalUsers),
      feedbackByRating: mapCountRows(feedbackRatingRows, totalFeedback),
      loansByStatus: mapCountRows(loanStatusRows, totalLoans),
      cibilRepairByStatus: mapCountRows(repairStatusRows, totalRepairRequests),
      disputesByStatus: mapCountRows(disputeStatusRows, totalDisputes),
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
  const status = String(options.status || "").trim();
  const subscribedOnly = ["true", "1"].includes(
    String(options.subscribedOnly || "").toLowerCase()
  );
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

  if (status) {
    conditions.push("u.status = ?");
    params.push(status);
  }

  if (subscribedOnly) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM subscription_payments subscribedPayment
      WHERE subscribedPayment.user_id = u.id
        AND subscribedPayment.payment_status = 'paid'
    )`);
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

async function listAdminBasicSubscriptions(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const status = String(options.status || "").trim();
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    const term = `%${search}%`;
    conditions.push(`(
      u.public_id LIKE ?
      OR u.full_name LIKE ?
      OR u.mobile_number LIKE ?
      OR u.pan_number LIKE ?
      OR u.email LIKE ?
    )`);
    params.push(term, term, term, term, term);
  }

  if (status) {
    conditions.push("u.subscription_status = ?");
    params.push(status);
  }

  if (from) {
    conditions.push("COALESCE(latestPayment.paid_at, latestPayment.created_at) >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("COALESCE(latestPayment.paid_at, latestPayment.created_at) <= ?");
    params.push(totime);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const joins = `FROM users u
    INNER JOIN subscription_plans sp ON sp.id = u.subscription_plan_id
    LEFT JOIN (
      SELECT user_id, MAX(id) AS latestPaymentId
      FROM subscription_payments
      WHERE payment_status = 'paid'
      GROUP BY user_id
    ) paidPayment
      ON paidPayment.user_id = u.id
    LEFT JOIN subscription_payments latestPayment
      ON latestPayment.id = paidPayment.latestPaymentId`;
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      ${joins}
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        u.public_id AS userPublicId,
        u.full_name AS userName,
        u.email,
        u.mobile_number AS mobileNumber,
        u.pan_number AS panNumber,
        u.subscription_status AS subscriptionStatus,
        u.subscription_started_at AS subscriptionStartedAt,
        u.subscription_due_at AS subscriptionDueAt,
        u.subscription_ends_at AS subscriptionEndsAt,
        sp.public_id AS planPublicId,
        sp.plan_name AS planName,
        latestPayment.amount,
        latestPayment.currency,
        latestPayment.payment_status AS paymentStatus,
        latestPayment.razorpay_payment_id AS razorpayPaymentId,
        latestPayment.paid_at AS paidAt,
        latestPayment.created_at AS createdAt
      ${joins}
      ${where}
      ORDER BY COALESCE(latestPayment.paid_at, latestPayment.created_at) DESC,
        latestPayment.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    subscriptions: rows.map((row) => ({
      userId: row.userPublicId,
      userPublicId: row.userPublicId,
      userName: row.userName,
      email: row.email,
      mobileNumber: row.mobileNumber,
      panNumber: row.panNumber,
      planId: row.planPublicId,
      planPublicId: row.planPublicId,
      planName: row.planName,
      amount: Number(row.amount),
      currency: row.currency,
      paymentStatus: row.paymentStatus,
      subscriptionStatus: row.subscriptionStatus,
      razorpayPaymentId: row.razorpayPaymentId,
      subscriptionStartedAt: row.subscriptionStartedAt,
      subscriptionDueAt: row.subscriptionDueAt,
      subscriptionEndsAt: row.subscriptionEndsAt,
      paidAt: row.paidAt,
      createdAt: row.createdAt
    })),
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
  listAdminBasicSubscriptions,
  listAdminLoans,
  listAdminUsers,
  updateAdminLoanById,
  updateUserSubscriptionByPublicId
};
