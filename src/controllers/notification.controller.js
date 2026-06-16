const {
  countUnreadNotificationsByUserPublicId,
  listNotificationsByUserPublicId,
  markAllNotificationsReadByUserPublicId,
  markNotificationReadByUserPublicId,
  upsertUserFcmToken
} = require("../models/notification.model");
const { sendToUser } = require("../services/notification.service");

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

async function registerDevice(req, res, next) {
  try {
    const fcmToken = String(req.body.fcmToken || "").trim();

    if (!fcmToken) {
      return res.status(400).json({
        status: "error",
        message: "fcmToken is required"
      });
    }

    const token = await upsertUserFcmToken(req.auth.internalUserId, {
      fcmToken,
      platform: req.body.platform || "android",
      deviceId: req.body.deviceId || null
    });

    return res.status(200).json({
      status: "success",
      message: "Device registered",
      data: {
        token
      }
    });
  } catch (error) {
    next(error);
  }
}

async function sendTestNotification(req, res, next) {
  try {
    const userId = Number(req.body.userId);

    if (!userId || !req.body.title || !req.body.body) {
      return res.status(400).json({
        status: "error",
        message: "userId, title and body are required"
      });
    }

    const result = await sendToUser(userId, {
      title: req.body.title,
      body: req.body.body,
      imageUrl: req.body.imageUrl || "",
      data: req.body.data || {},
      screen: req.body.screen
    });

    return res.status(200).json({
      status: "success",
      message: "Test notification sent",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyNotifications,
  readAllNotifications,
  readNotification,
  registerDevice,
  sendTestNotification
};
