const { randomUUID } = require("crypto");

const { pool } = require("../config/db");

function parseJson(value) {
  if (!value || typeof value !== "string") {
    return value || [];
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return [];
  }
}

function mapRole(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.publicId,
    publicId: row.publicId,
    roleName: row.roleName,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapPermission(row) {
  return {
    menuName: row.menuName,
    childMenuName: row.childMenuName,
    permissions: parseJson(row.permissions)
  };
}

function roleSelect() {
  return `SELECT
    public_id AS publicId,
    role_name AS roleName,
    description,
    status,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM employee_roles`;
}

async function listEmployeeRoles(options = {}) {
  const page = Math.max(Number(options.page) || 1, 1);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const search = String(options.search || "").trim();
  const status = String(options.status || "").trim();
  const conditions = ["deleted_at IS NULL"];
  const params = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }

  if (search) {
    const searchPattern = `%${search}%`;

    conditions.push("(role_name LIKE ? OR description LIKE ?)");
    params.push(searchPattern, searchPattern);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const [[countRows], [rows]] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
      FROM employee_roles
      ${where}`,
      params
    ),
    pool.query(
      `${roleSelect()}
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ?
      OFFSET ?`,
      [...params, limit, offset]
    )
  ]);
  const total = Number(countRows[0]?.total || 0);

  return {
    roles: rows.map(mapRole),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function findEmployeeRoleByPublicId(publicId) {
  const [[roleRows], [permissionRows]] = await Promise.all([
    pool.query(
      `${roleSelect()}
      WHERE public_id = ?
        AND deleted_at IS NULL
      LIMIT 1`,
      [publicId]
    ),
    pool.query(
      `SELECT
        erp.menu_name AS menuName,
        erp.child_menu_name AS childMenuName,
        erp.permissions
      FROM employee_role_permissions erp
      INNER JOIN employee_roles er ON er.id = erp.role_id
      WHERE er.public_id = ?
        AND er.deleted_at IS NULL
      ORDER BY erp.id ASC`,
      [publicId]
    )
  ]);
  const role = mapRole(roleRows[0]);

  if (!role) {
    return null;
  }

  return {
    ...role,
    menuAccess: permissionRows.map(mapPermission)
  };
}

async function replaceRolePermissions(connection, roleId, menuAccess) {
  await connection.query(
    "DELETE FROM employee_role_permissions WHERE role_id = ?",
    [roleId]
  );

  if (!menuAccess.length) {
    return;
  }

  await connection.query(
    `INSERT INTO employee_role_permissions (
      role_id,
      menu_name,
      child_menu_name,
      child_menu_key,
      permissions
    )
    VALUES ?`,
    [
      menuAccess.map((access) => [
        roleId,
        access.menuName,
        access.childMenuName,
        access.childMenuName || "",
        JSON.stringify(access.permissions)
      ])
    ]
  );
}

async function createEmployeeRole(values) {
  const connection = await pool.getConnection();
  const publicId = randomUUID();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO employee_roles (
        public_id,
        role_name,
        description,
        status,
        created_by_user_id,
        updated_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        publicId,
        values.roleName,
        values.description,
        values.status,
        values.updatedByUserId,
        values.updatedByUserId
      ]
    );

    await replaceRolePermissions(connection, result.insertId, values.menuAccess);
    await connection.commit();

    return findEmployeeRoleByPublicId(publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateEmployeeRoleByPublicId(publicId, values) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [roleRows] = await connection.query(
      "SELECT id FROM employee_roles WHERE public_id = ? AND deleted_at IS NULL LIMIT 1",
      [publicId]
    );
    const roleId = roleRows[0]?.id;

    if (!roleId) {
      await connection.rollback();
      return null;
    }

    const entries = Object.entries({
      role_name: values.roleName,
      description: values.description,
      status: values.status,
      updated_by_user_id: values.updatedByUserId
    }).filter(([, value]) => value !== undefined);

    if (entries.length > 0) {
      const setClause = entries.map(([column]) => `${column} = ?`).join(", ");

      await connection.query(
        `UPDATE employee_roles
        SET ${setClause},
          updated_at = NOW()
        WHERE id = ?`,
        [...entries.map(([, value]) => value), roleId]
      );
    }

    if (Array.isArray(values.menuAccess)) {
      await replaceRolePermissions(connection, roleId, values.menuAccess);
    }

    await connection.commit();

    return findEmployeeRoleByPublicId(publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteEmployeeRoleByPublicId(publicId, updatedByUserId) {
  const [result] = await pool.query(
    `UPDATE employee_roles
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

async function listMenuAccessByEmployeePublicId(employeePublicId) {
  const [rows] = await pool.query(
    `SELECT
      erp.menu_name AS menuName,
      erp.child_menu_name AS childMenuName,
      erp.permissions
    FROM employees e
    INNER JOIN employee_roles er ON er.id = e.role_id
    INNER JOIN employee_role_permissions erp ON erp.role_id = er.id
    WHERE e.public_id = ?
      AND e.status = 'active'
      AND e.deleted_at IS NULL
      AND er.status = 'active'
      AND er.deleted_at IS NULL
    ORDER BY erp.id ASC`,
    [employeePublicId]
  );

  return rows.map(mapPermission);
}

module.exports = {
  createEmployeeRole,
  deleteEmployeeRoleByPublicId,
  findEmployeeRoleByPublicId,
  listEmployeeRoles,
  listMenuAccessByEmployeePublicId,
  updateEmployeeRoleByPublicId
};
