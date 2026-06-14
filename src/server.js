const app = require("./app");
const { checkDatabaseConnection } = require("./config/db");
const env = require("./config/env");
const { startNotificationScheduler } = require("./services/notification-scheduler.service");

async function startServer() {
  try {
    await checkDatabaseConnection();
    console.log("Database connected");
  } catch (error) {
    console.warn(`Database connection failed: ${error.message}`);
  }

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`ScoreCare service running on http://0.0.0.0:${env.port}`);
    startNotificationScheduler();
  });
}

startServer();