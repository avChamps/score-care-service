const {
  createEmployeeRole,
  deleteEmployeeRoleByPublicId,
  findEmployeeRoleByPublicId,
  listEmployeeRoles,
  updateEmployeeRoleByPublicId
} = require("../models/employee-role.model");

const allowedPermissions = new Set(["view", "create", "read", "update", "delete", "export"]);
const defaultMenuAccess = [
  { menuName: "Dashboard", childMenuName: null, permissions: ["read"] },
  { menuName: "General", childMenuName: "Site Settings", permissions: ["read", "update"] },
  { menuName: "General", childMenuName: "Homepage Themes", permissions: ["create", "read", "update", "delete"] },
  { menuName: "General", childMenuName: "Legal Center", permissions: ["read", "update"] },
  { menuName: "General", childMenuName: "Notifications", permissions: ["create", "read"] },
  { menuName: "General", childMenuName: "FAQ", permissions: ["create", "read", "update", "delete"] },
  { menuName: "User management", childMenuName: "Users", permissions: ["read", "export"] },
  { menuName: "Employee management", childMenuName: "Employees", permissions: ["create", "read", "update", "delete"] },
  { menuName: "Employee management", childMenuName: "Roles", permissions: ["create", "read", "update", "delete"] },
  { menuName: "Subscriptions", childMenuName: "Subscriptions", permissions: ["read", "update"] },
  { menuName: "Plans & Benefits", childMenuName: "Basic plan", permissions: [] },
  { menuName: "Plans & Benefits", childMenuName: "Repair service", permissions: ["create", "read", "update", "delete"] },
  { menuName: "Chats", childMenuName: null, permissions: ["read"] },
  { menuName: "Feedback", childMenuName: null, permissions: ["read"] },
  { menuName: "Contact Us", childMenuName: null, permissions: ["read"] },
  { menuName: "Reports", childMenuName: "Downloads", permissions: ["read", "export"] },
  { menuName: "Reports", childMenuName: "Download CIBIL", permissions: ["read", "create"] }
];
const roleStatuses = new Set(["active", "inactive"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === null ? null : normalizeString(value) || null;
}

function normalizePermission(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeMenuAccess(menuAccess, errors, required = true) {
  if (!Array.isArray(menuAccess)) {
    if (required) {
      errors.push("menuAccess must be an array");
    }

    return required ? [] : undefined;
  }

  return menuAccess.map((access, index) => {
    const menuName = normalizeString(access.menuName);
    const childMenuName = normalizeNullableString(access.childMenuName);
    const permissions = Array.isArray(access.permissions)
      ? [...new Set(access.permissions.map(normalizePermission).filter(Boolean))]
      : [];

    if (!menuName) {
      errors.push(`menuAccess[${index}].menuName is required`);
    }

    if (!Array.isArray(access.permissions)) {
      errors.push(`menuAccess[${index}].permissions must be an array`);
    }

    for (const permission of permissions) {
      if (!allowedPermissions.has(permission)) {
        errors.push(`menuAccess[${index}].permissions has invalid permission`);
      }
    }

    return {
      menuName,
      childMenuName,
      permissions
    };
  });
}

function validateRolePayload(body, partial = false) {
  const errors = [];
  const value = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "roleName")) {
    value.roleName = normalizeString(body.roleName);

    if (!value.roleName) {
      errors.push("roleName is required");
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "description")) {
    value.description = normalizeNullableString(body.description);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "status")) {
    value.status = normalizeString(body.status || "active");

    if (!roleStatuses.has(value.status)) {
      errors.push("status must be active or inactive");
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "menuAccess")) {
    value.menuAccess = normalizeMenuAccess(body.menuAccess, errors, !partial);
  }

  return {
    errors,
    value
  };
}

async function getEmployeeMenuAccess(_req, res, next) {
  try {
    return res.status(200).json({
      status: "success",
      data: {
        menuAccess: defaultMenuAccess
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminEmployeeRoles(req, res, next) {
  try {
    const data = await listEmployeeRoles({
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

async function getAdminEmployeeRole(req, res, next) {
  try {
    const role = await findEmployeeRoleByPublicId(req.params.publicId);

    if (!role) {
      return res.status(404).json({
        status: "error",
        message: "Employee role not found"
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        role
      }
    });
  } catch (error) {
    next(error);
  }
}

async function createAdminEmployeeRole(req, res, next) {
  try {
    const { errors, value } = validateRolePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const role = await createEmployeeRole({
      ...value,
      updatedByUserId: req.auth.internalUserId || null
    });

    return res.status(201).json({
      status: "success",
      message: "Employee role created successfully",
      data: {
        role
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminEmployeeRole(req, res, next) {
  try {
    const { errors, value } = validateRolePayload(req.body, true);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const role = await updateEmployeeRoleByPublicId(req.params.publicId, {
      ...value,
      updatedByUserId: req.auth.internalUserId || null
    });

    if (!role) {
      return res.status(404).json({
        status: "error",
        message: "Employee role not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Employee role updated successfully",
      data: {
        role
      }
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAdminEmployeeRole(req, res, next) {
  try {
    const deleted = await deleteEmployeeRoleByPublicId(
      req.params.publicId,
      req.auth.internalUserId || null
    );

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Employee role not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Employee role deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAdminEmployeeRole,
  deleteAdminEmployeeRole,
  getAdminEmployeeRole,
  getAdminEmployeeRoles,
  getEmployeeMenuAccess,
  updateAdminEmployeeRole
};
