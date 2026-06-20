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

module.exports = {
  createEmployee,
  deleteEmployeeByPublicId,
  findActiveEmployeeByMobileNumber,
  findEmployeeByPublicId,
  listEmployees,
  updateEmployeeByPublicId
};
