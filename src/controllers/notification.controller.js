const {
  countUnreadNotificationsByUserPublicId,
  listNotificationsByUserPublicId,
  markAllNotificationsReadByUserPublicId,
  markNotificationReadByUserPublicId
} = require("../models/notification.model");

async function getMyNotifications(req, res, next) {
  try {
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsByUserPublicId(req.auth.userId, {
        limit: req.query.limit,
        offset: req.query.offset,
        unreadOnly: req.query.unreadOnly
      }),
      countUnreadNotificationsByUserPublicId(req.auth.userId)
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        unreadCount,
        notifications
      }
    });
  } catch (error) {
    next(error);
  }
}

async function readNotification(req, res, next) {
  try {
    const notification = await markNotificationReadByUserPublicId(
      req.auth.userId,
      req.params.notificationId
    );

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Notification not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Notification marked as read",
      data: {
        notification
      }
    });
  } catch (error) {
    next(error);
  }
}

async function readAllNotifications(req, res, next) {
  try {
    const updatedCount = await markAllNotificationsReadByUserPublicId(
      req.auth.userId
    );

    return res.status(200).json({
      status: "success",
      message: "Notifications marked as read",
      data: {
        updatedCount
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyNotifications,
  readAllNotifications,
  readNotification
};
