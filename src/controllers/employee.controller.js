const {
  createEmployee,
  deleteEmployeeByPublicId,
  findEmployeeDetailByPublicId,
  listEmployees,
  updateEmployeeByPublicId
} = require("../models/employee.model");

const employeeStatuses = new Set(["active", "inactive", "suspended"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNullableString(value) {
  return value === null ? null : normalizeString(value) || null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmployeePayload(body, errors, partial = false) {
  const value = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "employeeCode")) {
    value.employeeCode = normalizeNullableString(body.employeeCode);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "fullName")) {
    value.fullName = normalizeString(body.fullName);

    if (!value.fullName) {
      errors.push("fullName is required");
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "mobileNumber")) {
    value.mobileNumber = normalizeString(body.mobileNumber);

    if (!value.mobileNumber) {
      errors.push("mobileNumber is required");
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "email")) {
    value.email = normalizeNullableString(body.email);

    if (value.email && !isValidEmail(value.email)) {
      errors.push("email must be a valid email");
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "role")) {
    value.role = normalizeString(body.role);

    if (!value.role) {
      errors.push("role is required");
    }
  }

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(body, "rolePublicId") ||
    Object.prototype.hasOwnProperty.call(body, "roleId")
  ) {
    value.rolePublicId = normalizeNullableString(body.rolePublicId || body.roleId);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "department")) {
    value.department = normalizeNullableString(body.department);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "designation")) {
    value.designation = normalizeNullableString(body.designation);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "reportsTo")) {
    value.reportsTo = normalizeNullableString(body.reportsTo);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "status")) {
    value.status = normalizeString(body.status || "active");

    if (!employeeStatuses.has(value.status)) {
      errors.push("status must be active, inactive or suspended");
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "joinedAt")) {
    value.joinedAt = normalizeNullableString(body.joinedAt);
  }

  return value;
}

function validateCreateEmployeePayload(body) {
  const errors = [];

  return {
    errors,
    value: normalizeEmployeePayload(body, errors)
  };
}

function validateUpdateEmployeePayload(body) {
  const errors = [];

  return {
    errors,
    value: normalizeEmployeePayload(body, errors, true)
  };
}

async function getAdminEmployees(req, res, next) {
  try {
    const data = await listEmployees({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status,
      includeDeleted: req.query.includeDeleted
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminEmployee(req, res, next) {
  try {
    const data = await findEmployeeDetailByPublicId(req.params.publicId);

    if (!data) {
      return res.status(404).json({
        status: "error",
        message: "Employee not found"
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

async function createAdminEmployee(req, res, next) {
  try {
    const { errors, value } = validateCreateEmployeePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const employee = await createEmployee({
      ...value,
      updatedByUserId: req.auth.internalUserId
    });

    return res.status(201).json({
      status: "success",
      message: "Employee created successfully",
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateAdminEmployee(req, res, next) {
  try {
    const { errors, value } = validateUpdateEmployeePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const employee = await updateEmployeeByPublicId(req.params.publicId, {
      ...value,
      updatedByUserId: req.auth.internalUserId
    });

    if (!employee || employee.deletedAt) {
      return res.status(404).json({
        status: "error",
        message: "Employee not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Employee updated successfully",
      data: {
        employee
      }
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAdminEmployee(req, res, next) {
  try {
    const deleted = await deleteEmployeeByPublicId(
      req.params.publicId,
      req.auth.internalUserId
    );

    if (!deleted) {
      return res.status(404).json({
        status: "error",
        message: "Employee not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Employee deleted successfully"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAdminEmployee,
  deleteAdminEmployee,
  getAdminEmployee,
  getAdminEmployees,
  updateAdminEmployee
};
