const { verifyAuthToken } = require("../services/token.service");

function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      status: "error",
      message: "Bearer token is required"
    });
  }

  try {
    req.auth = verifyAuthToken(token);
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
