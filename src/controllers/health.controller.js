const { checkDatabaseConnection } = require("../config/db");

function getHealth(_req, res) {
  res.status(200).json({
    status: "ok",
    service: "score-care-service",
    timestamp: new Date().toISOString()
  });
}

async function getDatabaseHealth(_req, res, next) {
  try {
    await checkDatabaseConnection();

    res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHealth,
  getDatabaseHealth
};
