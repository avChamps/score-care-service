function notFoundHandler(req, res) {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    status: "error",
    message: statusCode === 500 ? "Internal server error" : error.message,
    details:
      process.env.NODE_ENV === "production"
        ? undefined
        : error.details || error.message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
