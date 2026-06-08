const { verifyAuthToken } = require("../services/token.service");
const {
  findUserById,
  findUserByPublicId
} = require("../models/user.model");

async function resolveInternalUserId(auth) {
  if (auth.internalUserId) {
    return auth.internalUserId;
  }

  const user = await findUserByPublicId(auth.userId) || await findUserById(auth.userId);

  return user?.internalId;
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
    const internalUserId = await resolveInternalUserId(auth);

    if (!internalUserId) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token"
      });
    }

    req.auth = {
      ...auth,
      internalUserId
    };

    return next();
  } catch (_error) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token"
    });
  }
}

module.exports = {
  requireAuth
};
