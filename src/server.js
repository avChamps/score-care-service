const app = require("./app");
const { checkDatabaseConnection } = require("./config/db");
const env = require("./config/env");
const { startNotificationScheduler } = require("./services/notification-scheduler.service");
const { startWhatsApp } = require("./services/whatsapp.service");

async function startServer() {
  try {
    await checkDatabaseConnection();
    console.log("Database connected");
  } catch (error) {
    console.warn(`Database connection failed: ${error.message}`);
  }

  app.listen(env.port, () => {
    console.log(`ScoreCare service running on port ${env.port}`);
    startNotificationScheduler();

    if (env.whatsapp.enabled) {
      startWhatsApp();
    }
  });
}

startServer();
