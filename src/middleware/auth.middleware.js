const { verifyAuthToken } = require("../services/token.service");
const {
  findUserById,
  findUserByPublicId
} = require("../models/user.model");
const {
  findEmployeeByPublicId
} = require("../models/employee.model");

async function resolveInternalUserId(auth) {
  if (auth.tokenType === "employee_access") {
    return null;
  }

  if (auth.internalUserId) {
    return auth.internalUserId;
  }

  const user = await findUserByPublicId(auth.userId) || await findUserById(auth.userId);

  return user?.internalId;
}

async function resolveInternalEmployeeId(auth) {
  if (auth.tokenType !== "employee_access") {
    return null;
  }

  const employee = await findEmployeeByPublicId(auth.employeeId);

  if (employee?.status !== "active" || employee.deletedAt) {
    return null;
  }

  return employee.internalId;
}

async function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      status: "error",
      message: "Bearer token is required"
    });
  }

  try {
    const auth = verifyAuthToken(token);
    const [internalUserId, internalEmployeeId] = await Promise.all([
      resolveInternalUserId(auth),
      resolveInternalEmployeeId(auth)
    ]);

    if (!internalUserId && !internalEmployeeId) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token"
      });
    }

    req.auth = {
      ...auth,
      internalUserId,
      internalEmployeeId
    };

    return next();
  } catch (_error) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token"
    });
  }
}

async function optionalAuth(req, _res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next();
  }

  try {
    const auth = verifyAuthToken(token);
    const [internalUserId, internalEmployeeId] = await Promise.all([
      resolveInternalUserId(auth),
      resolveInternalEmployeeId(auth)
    ]);

    if (internalUserId || internalEmployeeId) {
      req.auth = {
        ...auth,
        internalUserId,
        internalEmployeeId
      };
    }
  } catch (_error) {
    req.auth = null;
  }

  return next();
}

async function requireAdmin(req, res, next) {
  if (req.auth.tokenType === "employee_access" && req.auth.internalEmployeeId) {
    return next();
  }

  const user = await findUserById(req.auth.internalUserId);

  if (!user?.isAdmin) {
    return res.status(403).json({
      status: "error",
      message: "Admin access is required"
    });
  }

  return next();
}

module.exports = {
  optionalAuth,
  requireAdmin,
  requireAuth
};
