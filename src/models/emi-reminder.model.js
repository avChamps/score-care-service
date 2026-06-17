const { pool } = require("../config/db");

const emiTables = ["loan_emis", "emis"];
const dueDateColumns = ["due_date", "emi_due_date", "next_due_date"];
const amountColumns = ["emi_amount", "amount", "due_amount"];
const bankColumns = ["bank_name", "lender_name", "lender", "bank"];
const referenceColumns = ["loan_application_id", "loan_id", "account_id", "id"];

function formatDate(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(value, days) {
  const date = new Date(value);

  date.setDate(date.getDate() + days);

  return date;
}

function pickColumn(columns, candidates) {
  return candidates.find((column) => columns.has(column));
}

async function getTableColumns(tableName) {
  const [tables] = await pool.query("SHOW TABLES LIKE ?", [tableName]);

  if (!tables.length) {
    return null;
  }

  const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);

  return new Set(columns.map((column) => column.Field));
}

async function resolveEmiSource() {
  for (const tableName of emiTables) {
    const columns = await getTableColumns(tableName);

    if (!columns || !columns.has("user_id")) {
      continue;
    }

    const dueDateColumn = pickColumn(columns, dueDateColumns);

    if (!dueDateColumn) {
      continue;
    }

    return {
      tableName,
      dueDateColumn,
      amountColumn: pickColumn(columns, amountColumns),
      bankColumn: pickColumn(columns, bankColumns),
      referenceColumn: pickColumn(columns, referenceColumns) || "id",
      statusColumn: columns.has("status") ? "status" : null
    };
  }

  return null;
}

async function listEmiReminderCandidates(date = new Date()) {
  const source = await resolveEmiSource();

  if (!source) {
    return [];
  }

  const targetDate = formatDate(addDays(date, 2));
  const amountSelect = source.amountColumn
    ? `e.\`${source.amountColumn}\` AS emiAmount`
    : "NULL AS emiAmount";
  const bankSelect = source.bankColumn
    ? `e.\`${source.bankColumn}\` AS bankName`
    : "NULL AS bankName";
  const statusFilter = source.statusColumn
    ? `AND LOWER(COALESCE(e.\`${source.statusColumn}\`, 'active')) IN ('active', 'pending', 'due', 'unpaid')`
    : "";

  const [rows] = await pool.query(
    `SELECT
      e.id,
      e.\`${source.referenceColumn}\` AS referenceId,
      e.user_id AS internalUserId,
      e.\`${source.dueDateColumn}\` AS dueDate,
      ${amountSelect},
      ${bankSelect},
      u.public_id AS userPublicId,
      u.full_name AS fullName,
      u.mobile_number AS mobileNumber,
      u.email
    FROM \`${source.tableName}\` e
    INNER JOIN users u ON u.id = e.user_id
    WHERE DATE(e.\`${source.dueDateColumn}\`) = ?
      ${statusFilter}
      AND NOT EXISTS (
        SELECT 1
        FROM notification_logs nl
        WHERE nl.user_id = e.user_id
          AND nl.notification_type = 'emi_due_reminder'
          AND nl.reference_type = ?
          AND nl.reference_id = CAST(e.\`${source.referenceColumn}\` AS CHAR)
          AND nl.scheduled_for = ?
      )`,
    [targetDate, source.tableName, targetDate]
  );

  return rows.map((row) => ({
    user: {
      internalId: row.internalUserId,
      id: row.userPublicId,
      publicId: row.userPublicId,
      fullName: row.fullName,
      mobileNumber: row.mobileNumber,
      email: row.email
    },
    emi: {
      id: row.id,
      referenceType: source.tableName,
      referenceId: row.referenceId,
      dueDate: row.dueDate,
      emiAmount: row.emiAmount,
      bankName: row.bankName,
      scheduledFor: targetDate
    }
  }));
}

module.exports = {
  listEmiReminderCandidates
};
