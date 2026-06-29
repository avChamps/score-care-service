const {
  exportAdminLoans,
  exportAdminUsers,
  findAdminLoanById,
  findAdminUserDetailByPublicId,
  getDashboardCounts,
  listAdminBasicSubscriptions,
  listAdminChats,
  listAdminLoans,
  listAdminUsers,
  updateAdminLoanById,
  updateUserSubscriptionByPublicId
} = require("../models/admin.model");
const {
  createLoanStatusUpdatedNotification
} = require("../models/notification.model");
const {
  sendStoredNotificationToUser
} = require("../services/mobile-notification.service");
const { readSavedFile } = require("../utils/upload-assets");

const subscriptionStatuses = new Set([
  "free",
  "active",
  "past_due",
  "expired",
  "cancelled"
]);
const loanStatuses = new Set(["submitted", "in_review", "approved", "rejected"]);

async function getAdminDashboardCounts(req, res, next) {
  try {
    const counts = await getDashboardCounts({
      from: req.query.from,
      totime: req.query.totime
    });

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
      search: req.query.search,
      status: req.query.status,
      subscribedOnly: req.query.subscribedOnly,
      from: req.query.from,
      totime: req.query.totime
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminUserDetail(req, res, next) {
  try {
    const data = await findAdminUserDetailByPublicId(req.params.publicId);

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "User not found"
      });
    }

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminBasicSubscriptions(req, res, next) {
  try {
    const data = await listAdminBasicSubscriptions({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status,
      from: req.query.from,
      totime: req.query.totime
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminLoans(req, res, next) {
  try {
    const data = await listAdminLoans({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminChats(req, res, next) {
  try {
    const data = await listAdminChats({
      page: req.query.page,
      limit: req.query.limit,
      messageLimit: req.query.messageLimit,
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

function validateLoanUpdatePayload(body) {
  const errors = [];
  const status = String(body.status || "").trim();
  const remarks =
    body.remarks === undefined || body.remarks === null
      ? null
      : String(body.remarks).trim();

  if (!loanStatuses.has(status)) {
    errors.push("Valid status is required");
  }

  return {
    errors,
    value: {
      status,
      remarks
    }
  };
}

async function updateAdminLoan(req, res, next) {
  try {
    const { errors, value } = validateLoanUpdatePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const loan = await updateAdminLoanById(req.params.loanId, {
      ...value,
      updatedByUserId: req.auth.internalUserId
    });

    if (!loan) {
      return res.status(404).json({
        status: "error",
        message: "Loan application not found"
      });
    }

    const notification = await createLoanStatusUpdatedNotification(
      loan.internalUserId,
      loan
    );
    await sendStoredNotificationToUser(loan.internalUserId, notification);

    return res.status(200).json({
      status: "success",
      message: "Loan application updated successfully",
      data: {
        loan,
        notification
      }
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
    ["subscriptionAmount", (user) => user.subscriptionAmount],
    ["latestSubscriptionAmount", (user) => user.latestSubscriptionAmount],
    ["planUpdatedBy", (user) => user.planUpdatedBy?.fullName],
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
      search: req.query.search,
      from: req.query.from,
      totime: req.query.totime
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

function buildLoansCsv(loans) {
  const columns = [
    ["loanId", (loan) => loan.id],
    ["userId", (loan) => loan.userId],
    ["fullName", (loan) => loan.user.fullName],
    ["mobileNumber", (loan) => loan.user.mobileNumber],
    ["panNumber", (loan) => loan.user.panNumber],
    ["email", (loan) => loan.user.email],
    ["loanAmount", (loan) => loan.loanAmount],
    ["loanType", (loan) => loan.loanType],
    ["employmentType", (loan) => loan.employmentType],
    ["monthlyIncome", (loan) => loan.monthlyIncome],
    ["workExperience", (loan) => loan.workExperience],
    ["status", (loan) => loan.status],
    ["remarks", (loan) => loan.remarks],
    ["updatedBy", (loan) => loan.updatedBy?.fullName],
    ["createdAt", (loan) => loan.createdAt],
    ["updatedAt", (loan) => loan.updatedAt]
  ];
  const header = columns.map(([label]) => label).join(",");
  const rows = loans.map((loan) =>
    columns.map(([, getValue]) => escapeCsvValue(getValue(loan))).join(",")
  );

  return [header, ...rows].join("\n");
}

async function exportAdminLoansCsv(req, res, next) {
  try {
    const loans = await exportAdminLoans({
      search: req.query.search,
      status: req.query.status
    });
    const csv = buildLoansCsv(loans);

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"scorecare-loans.csv\""
    });

    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}

const crcTable = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function getCrc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function sanitizeZipPathSegment(value) {
  return String(value || "file")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBuffer = Buffer.from(file.name);
    const content = file.content;
    const crc = getCrc32(content);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + content.length;
  });

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const endHeader = Buffer.alloc(22);

  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(files.length, 8);
  endHeader.writeUInt16LE(files.length, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(offset, 16);
  endHeader.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endHeader]);
}

function flattenLoanDocuments(documents = {}) {
  return Object.entries(documents).flatMap(([fieldName, files]) =>
    (Array.isArray(files) ? files : []).map((file) => ({
      ...file,
      fieldName
    }))
  );
}

async function downloadAdminLoanDetails(req, res, next) {
  try {
    const loan = await findAdminLoanById(req.params.loanId);

    if (!loan) {
      return res.status(404).json({
        status: "error",
        message: "Loan application not found"
      });
    }

    const files = await Promise.all(
      flattenLoanDocuments(loan.documents)
        .filter((file) => file.relativePath)
        .map(async (file, index) => ({
          name: `${sanitizeZipPathSegment(file.fieldName)}/${index + 1}-${sanitizeZipPathSegment(
            file.originalName || file.fileName
          )}`,
          content: await readSavedFile(file.relativePath)
        }))
    );

    if (files.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Loan documents not found"
      });
    }

    const zip = buildZip(files);

    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="loan-${loan.id}-documents.zip"`,
      "Content-Length": zip.length
    });

    return res.status(200).send(zip);
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
  const amount =
    body.amount === undefined || body.amount === null || body.amount === ""
      ? null
      : Number(body.amount);

  if (!subscriptionStatuses.has(subscriptionStatus)) {
    errors.push("Valid subscriptionStatus is required");
  }

  if (
    (body.durationDays || body.days) &&
    (!Number.isInteger(durationDays) || durationDays < 1)
  ) {
    errors.push("durationDays must be a positive integer");
  }

  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    errors.push("amount must be a valid positive number");
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
          : endsAt || dueAt || (durationDays ? addDays(startedAt, durationDays) : null),
      amount
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
      {
        ...value,
        updatedByUserId: req.auth.internalUserId
      }
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
  downloadAdminLoanDetails,
  exportAdminLoansCsv,
  exportAdminUsersCsv,
  getAdminChats,
  getAdminBasicSubscriptions,
  getAdminDashboardCounts,
  getAdminLoans,
  getAdminUserDetail,
  getAdminUsers,
  updateAdminLoan,
  updateAdminUserSubscription
};
