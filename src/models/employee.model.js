const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function mapEmployee(row) {
  if (!row) {
    return null;
  }

  const employee = {
    id: row.publicId,
    publicId: row.publicId,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    mobileNumber: row.mobileNumber,
    email: row.email,
    role: row.role,
    roleId: row.rolePublicId,
    rolePublicId: row.rolePublicId,
    roleName: row.roleName,
    department: row.department,
    designation: row.designation,
    status: row.status,
    authenticatorEnabled: Boolean(row.authenticatorEnabledAt),
    joinedAt: row.joinedAt,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };

  Object.defineProperty(employee, "internalId", {
    value: row.internalId,
    enumerable: false
  });

  return employee;
}

function employeeSelect() {
  return `SELECT
    id AS internalId,
    public_id AS publicId,
    employee_code AS employeeCode,
    full_name AS fullName,
    mobile_number AS mobileNumber,
    email,
    role,
    (
      SELECT public_id
      FROM employee_roles
      WHERE employee_roles.id = employees.role_id
    ) AS rolePublicId,
    (
      SELECT role_name
      FROM employee_roles
      WHERE employee_roles.id = employees.role_id
    ) AS roleName,
    department,
    designation,
    status,
    totp_enabled_at AS authenticatorEnabledAt,
    joined_at AS joinedAt,
    deleted_at AS deletedAt,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM employees`;
}

async function listEmployees(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const status = String(options.status || "").trim();
  const includeDeleted = String(options.includeDeleted || "").toLowerCase() === "true";
  const conditions = [];
  const params = [];

  if (!includeDeleted) {
    conditions.push("deleted_at IS NULL");
  }

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push(`(
      employee_code LIKE ?
      OR full_name LIKE ?
      OR mobile_number LIKE ?
      OR email LIKE ?
      OR role LIKE ?
      OR department LIKE ?
      OR designation LIKE ?
    )`);
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM employees
      ${where}`,
      params
    ),
    pool.query(
      `${employeeSelect()}
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    employees: rows.map(mapEmployee),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function findEmployeeByPublicId(publicId) {
  const [rows] = await pool.query(
    `${employeeSelect()}
    WHERE public_id = ?
    LIMIT 1`,
    [publicId]
  );

  return mapEmployee(rows[0]);
}

async function findEmployeeByPublicIdOrCode(value) {
  const [rows] = await pool.query(
    `${employeeSelect()}
    WHERE public_id = ?
      OR employee_code = ?
    LIMIT 1`,
    [value, value]
  );

  return mapEmployee(rows[0]);
}

async function findActiveEmployeeByMobileNumber(mobileNumber) {
  const [rows] = await pool.query(
    `${employeeSelect()}
    WHERE mobile_number = ?
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1`,
    [mobileNumber]
  );

  return mapEmployee(rows[0]);
}

async function getEmployeeAuthenticator(publicId) {
  const [rows] = await pool.query(
    `SELECT
      totp_secret AS encryptedSecret,
      totp_enabled_at AS enabledAt,
      totp_last_used_step AS lastUsedStep
    FROM employees
    WHERE public_id = ?
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1`,
    [publicId]
  );

  return rows[0] || null;
}

async function setEmployeeAuthenticatorSecret(publicId, encryptedSecret) {
  await pool.query(
    `UPDATE employees
    SET totp_secret = COALESCE(totp_secret, ?),
      updated_at = NOW()
    WHERE public_id = ?
      AND status = 'active'
      AND deleted_at IS NULL`,
    [encryptedSecret, publicId]
  );

  return getEmployeeAuthenticator(publicId);
}

async function consumeEmployeeAuthenticatorStep(publicId, step) {
  const [result] = await pool.query(
    `UPDATE employees
    SET totp_enabled_at = COALESCE(totp_enabled_at, NOW()),
      totp_last_used_step = ?,
      updated_at = NOW()
    WHERE public_id = ?
      AND status = 'active'
      AND deleted_at IS NULL
      AND (totp_last_used_step IS NULL OR totp_last_used_step < ?)`,
    [step, publicId, step]
  );

  return result.affectedRows > 0;
}

async function resolveRoleId(rolePublicId) {
  if (!rolePublicId) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id
    FROM employee_roles
    WHERE public_id = ?
      AND deleted_at IS NULL
    LIMIT 1`,
    [rolePublicId]
  );

  return rows[0]?.id || null;
}

async function createEmployee(values) {
  const publicId = randomUUID();
  const roleId = await resolveRoleId(values.rolePublicId);

  const [result] = await pool.query(
    `INSERT INTO employees (
      public_id,
      employee_code,
      full_name,
      mobile_number,
      email,
      role,
      role_id,
      department,
      designation,
      status,
      joined_at,
      created_by_user_id,
      updated_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      publicId,
      null,
      values.fullName,
      values.mobileNumber,
      values.email,
      values.role,
      roleId,
      values.department,
      values.designation,
      values.status,
      values.joinedAt,
      values.updatedByUserId,
      values.updatedByUserId
    ]
  );

  await pool.query(
    `UPDATE employees
    SET employee_code = ?
    WHERE id = ?`,
    [`EMP${String(result.insertId).padStart(3, "0")}`, result.insertId]
  );

  return findEmployeeByPublicId(publicId);
}

async function updateEmployeeByPublicId(publicId, values) {
  const roleId = Object.prototype.hasOwnProperty.call(values, "rolePublicId")
    ? await resolveRoleId(values.rolePublicId)
    : undefined;
  const entries = Object.entries({
    employee_code: values.employeeCode,
    full_name: values.fullName,
    mobile_number: values.mobileNumber,
    email: values.email,
    role: values.role,
    role_id: roleId,
    department: values.department,
    designation: values.designation,
    status: values.status,
    joined_at: values.joinedAt,
    updated_by_user_id: values.updatedByUserId
  }).filter(([, value]) => value !== undefined);

  if (entries.length > 0) {
    const setClause = entries.map(([column]) => `${column} = ?`).join(", ");

    await pool.query(
      `UPDATE employees
      SET ${setClause},
        updated_at = NOW()
      WHERE public_id = ?
        AND deleted_at IS NULL`,
      [...entries.map(([, value]) => value), publicId]
    );
  }

  return findEmployeeByPublicId(publicId);
}

async function deleteEmployeeByPublicId(publicId, updatedByUserId) {
  const [result] = await pool.query(
    `UPDATE employees
    SET
      status = 'inactive',
      deleted_at = NOW(),
      updated_by_user_id = ?,
      updated_at = NOW()
    WHERE public_id = ?
      AND deleted_at IS NULL`,
    [updatedByUserId, publicId]
  );

  return result.affectedRows > 0;
}

async function createEmployeeLoginEvent(employee, login) {
  const [result] = await pool.query(
    `INSERT INTO employee_login_events (
      employee_id,
      employee_public_id,
      mobile_number,
      login_method,
      login_status,
      ip_address,
      user_agent,
      device_id,
      metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employee.internalId,
      employee.publicId,
      employee.mobileNumber,
      login.loginMethod || "otp_totp",
      login.loginStatus || "success",
      login.ipAddress || null,
      login.userAgent || null,
      login.deviceId || null,
      login.metadata ? JSON.stringify(login.metadata) : null
    ]
  );

  return result.insertId;
}

async function markEmployeeLoginEventLoggedOut(employeeId, loginEventId) {
  const params = [employeeId];
  const eventCondition = loginEventId ? "AND id = ?" : "";

  if (loginEventId) {
    params.push(loginEventId);
  }

  const [result] = await pool.query(
    `UPDATE employee_login_events
    SET logged_out_at = NOW(),
      updated_at = NOW()
    WHERE employee_id = ?
      ${eventCondition}
      AND logged_out_at IS NULL
    ORDER BY logged_in_at DESC, id DESC
    LIMIT 1`,
    params
  );

  return result.affectedRows;
}

async function listEmployeeLoginEvents(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const from = String(options.from || "").trim();
  const totime = String(options.totime || "").trim();
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`(
      e.full_name LIKE ?
      OR e.mobile_number LIKE ?
      OR e.email LIKE ?
      OR e.employee_code LIKE ?
    )`);
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (from) {
    conditions.push("DATE(ele.logged_in_at) >= ?");
    params.push(from);
  }

  if (totime) {
    conditions.push("DATE(ele.logged_in_at) <= ?");
    params.push(totime);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM employee_login_events ele
      INNER JOIN employees e ON e.id = ele.employee_id
      ${where}`,
      params
    ),
    pool.query(
      `SELECT
        ele.id,
        ele.employee_public_id AS employeePublicId,
        e.full_name AS employeeName,
        e.employee_code AS employeeCode,
        ele.mobile_number AS mobileNumber,
        e.email,
        ele.login_method AS loginMethod,
        ele.login_status AS loginStatus,
        ele.ip_address AS ipAddress,
        ele.user_agent AS userAgent,
        ele.device_id AS deviceId,
        ele.metadata,
        ele.logged_in_at AS loggedInAt,
        ele.logged_out_at AS loggedOutAt
      FROM employee_login_events ele
      INNER JOIN employees e ON e.id = ele.employee_id
      ${where}
      ORDER BY ele.logged_in_at DESC, ele.id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    loginEvents: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

module.exports = {
  consumeEmployeeAuthenticatorStep,
  createEmployee,
  createEmployeeLoginEvent,
  deleteEmployeeByPublicId,
  findActiveEmployeeByMobileNumber,
  findEmployeeByPublicId,
  findEmployeeByPublicIdOrCode,
  getEmployeeAuthenticator,
  listEmployeeLoginEvents,
  listEmployees,
  markEmployeeLoginEventLoggedOut,
  setEmployeeAuthenticatorSecret,
  updateEmployeeByPublicId
};
