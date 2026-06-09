const { pool } = require("../src/config/db");
const {
  runMonthlyCibilNotificationJob
} = require("../src/services/notification-scheduler.service");

runMonthlyCibilNotificationJob()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    await pool.end();
    console.error(error.message);
    process.exitCode = 1;
  });
