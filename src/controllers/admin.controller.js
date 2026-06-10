const {
  exportAdminUsers,
  getDashboardCounts,
  listAdminUsers,
  updateUserSubscriptionByPublicId
} = require("../models/admin.model");

const subscriptionStatuses = new Set([
  "free",
  "active",
  "past_due",
  "expired",
  "cancelled"
]);

async function getAdminDashboardCounts(_req, res, next) {
  try {
    const counts = await getDashboardCounts();

    return res.status(200).json({
      status: "success",
      data: counts
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminUsers(req, res, next) {
  try {
    const data = await listAdminUsers({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildUsersCsv(users) {
  const columns = [
    ["publicId", (user) => user.publicId],
    ["fullName", (user) => user.fullName],
    ["mobileNumber", (user) => user.mobileNumber],
    ["panNumber", (user) => user.panNumber],
    ["email", (user) => user.email],
    ["dateOfBirth", (user) => user.dateOfBirth],
    ["isAdmin", (user) => user.isAdmin],
    ["status", (user) => user.status],
    ["accessType", (user) => user.accessType],
    ["subscriptionStatus", (user) => user.subscriptionStatus],
    ["subscriptionStartedAt", (user) => user.subscriptionStartedAt],
    ["subscriptionDueAt", (user) => user.subscriptionDueAt],
    ["subscriptionEndsAt", (user) => user.subscriptionEndsAt],
    ["creditScore", (user) => user.creditScore],
    ["creditScoreLastCheckedAt", (user) => user.creditScoreLastCheckedAt],
    ["totalMessages", (user) => user.totalMessages],
    ["totalLoans", (user) => user.loans.total],
    ["latestLoanStatus", (user) => user.loans.latestStatus],
    ["latestLoanAppliedAt", (user) => user.loans.latestAppliedAt],
    ["lastLoginAt", (user) => user.lastLoginAt],
    ["createdAt", (user) => user.createdAt],
    ["updatedAt", (user) => user.updatedAt]
  ];
  const header = columns.map(([label]) => label).join(",");
  const rows = users.map((user) =>
    columns.map(([, getValue]) => escapeCsvValue(getValue(user))).join(",")
  );

  return [header, ...rows].join("\n");
}

async function exportAdminUsersCsv(req, res, next) {
  try {
    const users = await exportAdminUsers({
      search: req.query.search
    });
    const csv = buildUsersCsv(users);

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"scorecare-users.csv\""
    });

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}

function toDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function validateSubscriptionPayload(body) {
  const errors = [];
  const subscriptionStatus = String(body.subscriptionStatus || body.type || "").trim();
  const durationDays = Number(body.durationDays || body.days || 0);
  const startedAt = toDateTime(body.subscriptionStartedAt || body.startedAt) || new Date();
  const dueAt = toDateTime(body.subscriptionDueAt || body.dueAt);
  const endsAt = toDateTime(body.subscriptionEndsAt || body.endsAt);

  if (!subscriptionStatuses.has(subscriptionStatus)) {
    errors.push("Valid subscriptionStatus is required");
  }

  if (
    (body.durationDays || body.days) &&
    (!Number.isInteger(durationDays) || durationDays < 1)
  ) {
    errors.push("durationDays must be a positive integer");
  }

  return {
    errors,
    value: {
      subscriptionStatus,
      subscriptionStartedAt: subscriptionStatus === "free" ? null : startedAt,
      subscriptionDueAt:
        subscriptionStatus === "free"
          ? null
          : dueAt || (durationDays ? addDays(startedAt, durationDays) : null),
      subscriptionEndsAt:
        subscriptionStatus === "free"
          ? null
          : endsAt || dueAt || (durationDays ? addDays(startedAt, durationDays) : null)
    }
  };
}

async function updateAdminUserSubscription(req, res, next) {
  try {
    const { errors, value } = validateSubscriptionPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const user = await updateUserSubscriptionByPublicId(
      req.params.publicId,
      value
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Subscription updated successfully",
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  exportAdminUsersCsv,
  getAdminDashboardCounts,
  getAdminUsers,
  updateAdminUserSubscription
};
