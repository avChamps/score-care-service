const {
  sendToMultipleUsers,
  sendToUser
} = require("./notification.service");

function buildPayload(notification) {
  return {
    title: notification.title,
    body: notification.message,
    data: {
      notificationId: notification.id,
      type: notification.type,
      ...(notification.data || {})
    }
  };
}

async function sendStoredNotificationToUser(userId, notification) {
  if (!userId || !notification) {
    return null;
  }

  try {
    return await sendToUser(userId, buildPayload(notification));
  } catch (error) {
    console.error(`Mobile notification failed: ${error.message}`);
    return null;
  }
}

async function sendMonthlyCibilReportPush(userIds, monthKey) {
  const ids = [...new Set(userIds.map(Number).filter(Boolean))];

  if (!ids.length) {
    return null;
  }

  try {
    return await sendToMultipleUsers(ids, {
      title: "CIBIL report updated",
      body: "Your monthly CIBIL report update is available.",
      data: {
        type: "cibil_report_updated",
        month: monthKey
      }
    });
  } catch (error) {
    console.error(`Monthly CIBIL mobile notification failed: ${error.message}`);
    return null;
  }
}

module.exports = {
  sendMonthlyCibilReportPush,
  sendStoredNotificationToUser
};
