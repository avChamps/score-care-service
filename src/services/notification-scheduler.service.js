const cron = require("node-cron");

const env = require("../config/env");
const {
  createMonthlyCibilReportNotifications
} = require("../models/notification.model");
const {
  sendMonthlyCibilReportPush
} = require("./mobile-notification.service");

function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

async function runMonthlyCibilNotificationJob(date = new Date()) {
  const monthKey = getCurrentMonthKey(date);
  const result = await createMonthlyCibilReportNotifications(monthKey);

  if (result.affectedRows) {
    await sendMonthlyCibilReportPush(result.userIds, monthKey);
  }

  console.log(
    `Monthly CIBIL notification job completed for ${monthKey}: ${result.affectedRows} rows affected`
  );

  return result;
}

function startNotificationScheduler() {
  if (!env.notifications.monthlyCibilEnabled) {
    console.log("Monthly CIBIL notification scheduler disabled");
    return null;
  }

  if (!cron.validate(env.notifications.monthlyCibilCron)) {
    console.warn(
      `Invalid monthly CIBIL notification cron: ${env.notifications.monthlyCibilCron}`
    );
    return null;
  }

  const task = cron.schedule(
    env.notifications.monthlyCibilCron,
    () => {
      runMonthlyCibilNotificationJob().catch((error) => {
        console.error(`Monthly CIBIL notification job failed: ${error.message}`);
      });
    },
    {
      timezone: env.notifications.timezone
    }
  );

  console.log(
    `Monthly CIBIL notification scheduler started: ${env.notifications.monthlyCibilCron} ${env.notifications.timezone}`
  );

  return task;
}

module.exports = {
  getCurrentMonthKey,
  runMonthlyCibilNotificationJob,
  startNotificationScheduler
};
