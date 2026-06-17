const cron = require("node-cron");

const env = require("../config/env");
const {
  createInactiveUserReminderNotifications,
  createMonthlyCibilReportNotifications,
  createSubscriptionRenewalReminderNotifications
} = require("../models/notification.model");
const {
  createPendingNotificationLog,
  updateNotificationLogStatus
} = require("../models/notification-log.model");
const {
  listEmiReminderCandidates
} = require("../models/emi-reminder.model");
const {
  sendMonthlyCibilReportPush,
  sendStoredNotificationToUser
} = require("./mobile-notification.service");
const {
  sendEmiDueReminderWhatsapp,
  sendInactiveUserWhatsapp,
  sendSubscriptionRenewalWhatsapp,
  sendWhatsAppSafely,
  templates
} = require("./whatsappNotification.service");

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

async function sendReminderNotifications(reminders, sendWhatsapp) {
  for (const reminder of reminders) {
    await sendStoredNotificationToUser(reminder.user.userId, reminder.notification);
    await sendWhatsAppSafely(() => sendWhatsapp(reminder.user, reminder.notification));
  }
}

async function runEmiReminderNotificationJob(date = new Date()) {
  const reminders = await listEmiReminderCandidates(date);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders) {
    const message = templates.emiDueReminder(reminder.user, reminder.emi);
    const log = await createPendingNotificationLog({
      userId: reminder.user.internalId,
      notificationType: "emi_due_reminder",
      referenceType: reminder.emi.referenceType,
      referenceId: reminder.emi.referenceId,
      recipientMobile: String(reminder.user.mobileNumber || ""),
      message,
      scheduledFor: reminder.emi.scheduledFor
    });

    if (!log) {
      skipped += 1;
      continue;
    }

    const response = await sendWhatsAppSafely(() => (
      sendEmiDueReminderWhatsapp(reminder.user, reminder.emi)
    ));
    const status = response.status === "sent"
      ? "sent"
      : response.status === "skipped" ? "skipped" : "failed";

    await updateNotificationLogStatus(log.id, status, response);

    if (status === "sent") {
      sent += 1;
    } else if (status === "skipped") {
      skipped += 1;
    } else {
      failed += 1;
    }
  }

  console.log(
    `EMI reminder notification job completed: ${sent} sent, ${failed} failed, ${skipped} skipped`
  );

  return {
    total: reminders.length,
    sent,
    failed,
    skipped
  };
}

async function runDailyReminderNotificationJob() {
  const [
    subscriptionRenewals,
    inactiveUsers,
    emiReminders
  ] = await Promise.all([
    createSubscriptionRenewalReminderNotifications(),
    createInactiveUserReminderNotifications(),
    runEmiReminderNotificationJob()
  ]);

  await sendReminderNotifications(
    subscriptionRenewals,
    sendSubscriptionRenewalWhatsapp
  );
  await sendReminderNotifications(
    inactiveUsers,
    sendInactiveUserWhatsapp
  );

  console.log(
    `Daily reminder notification job completed: ${subscriptionRenewals.length} subscription renewals, ${inactiveUsers.length} inactive users, ${emiReminders.sent} EMI reminders sent`
  );

  return {
    subscriptionRenewals: subscriptionRenewals.length,
    inactiveUsers: inactiveUsers.length,
    emiReminders
  };
}

function startNotificationScheduler() {
  const tasks = [];

  if (env.notifications.monthlyCibilEnabled) {
    if (!cron.validate(env.notifications.monthlyCibilCron)) {
      console.warn(
        `Invalid monthly CIBIL notification cron: ${env.notifications.monthlyCibilCron}`
      );
    } else {
      const monthlyTask = cron.schedule(
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

      tasks.push(monthlyTask);
      console.log(
        `Monthly CIBIL notification scheduler started: ${env.notifications.monthlyCibilCron} ${env.notifications.timezone}`
      );
    }
  } else {
    console.log("Monthly CIBIL notification scheduler disabled");
  }

  if (env.notifications.remindersEnabled) {
    if (!cron.validate(env.notifications.dailyReminderCron)) {
      console.warn(
        `Invalid daily reminder notification cron: ${env.notifications.dailyReminderCron}`
      );
    } else {
      const dailyTask = cron.schedule(
        env.notifications.dailyReminderCron,
        () => {
          runDailyReminderNotificationJob().catch((error) => {
            console.error(`Daily reminder notification job failed: ${error.message}`);
          });
        },
        {
          timezone: env.notifications.timezone
        }
      );

      tasks.push(dailyTask);
      console.log(
        `Daily reminder notification scheduler started: ${env.notifications.dailyReminderCron} ${env.notifications.timezone}`
      );
    }
  } else {
    console.log("Daily reminder notification scheduler disabled");
  }

  return tasks;
}

module.exports = {
  getCurrentMonthKey,
  runDailyReminderNotificationJob,
  runEmiReminderNotificationJob,
  runMonthlyCibilNotificationJob,
  startNotificationScheduler
};
