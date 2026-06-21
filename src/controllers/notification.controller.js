const { randomUUID } = require("crypto");

const {
  countUnreadNotificationsByUserPublicId,
  createAdminAppNotifications,
  listAdminNotificationTargetUsers,
  listAdminSentAppNotifications,
  listNotificationsByUserPublicId,
  markAllNotificationsReadByUserPublicId,
  markNotificationReadByUserPublicId,
  upsertUserFcmToken
} = require("../models/notification.model");
const {
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead
} = require("../models/admin-notification.model");
const {
  sendToMultipleUsers,
  sendToUser
} = require("../services/notification.service");

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function validateAdminAppNotificationPayload(body) {
  const userPublicIds = Array.isArray(body.userPublicIds)
    ? body.userPublicIds.map(normalizeString).filter(Boolean)
    : [];
  const scope = normalizeString(body.scope || (userPublicIds.length ? "users" : "all"));
  const title = normalizeString(body.title);
  const message = normalizeString(body.message || body.body);
  const errors = [];

  if (!title) {
    errors.push("title is required");
  }

  if (!message) {
    errors.push("message is required");
  }

  if (!["all", "users"].includes(scope)) {
    errors.push("scope must be all or users");
  }

  if (scope === "users" && userPublicIds.length === 0) {
    errors.push("userPublicIds is required");
  }

  return {
    errors,
    value: {
      scope,
      userPublicIds,
      title,
      message,
      imageUrl: normalizeString(body.imageUrl) || undefined,
      screen: normalizeString(body.screen) || undefined,
      data: normalizeObject(body.data)
    }
  };
}

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

async function sendAdminAppNotification(req, res, next) {
  try {
    const { errors, value } = validateAdminAppNotificationPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const users = await listAdminNotificationTargetUsers({
      userPublicIds: value.scope === "users" ? value.userPublicIds : []
    });

    if (users.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No users found"
      });
    }

    const batchId = randomUUID();
    const notifications = await createAdminAppNotifications(users, {
      ...value,
      batchId
    });
    const push = await sendToMultipleUsers(
      users.map((user) => user.userId),
      {
        title: value.title,
        body: value.message,
        imageUrl: value.imageUrl,
        screen: value.screen,
        data: {
          ...value.data,
          type: "admin_app_notification",
          batchId
        }
      }
    );

    return res.status(201).json({
      status: "success",
      message: "App notification sent successfully",
      data: {
        batchId,
        recipientCount: users.length,
        savedCount: notifications.length,
        push
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminSentAppNotifications(req, res, next) {
  try {
    const data = await listAdminSentAppNotifications({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      from: req.query.from,
      totime: req.query.totime
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminNotifications(req, res, next) {
  try {
    const data = await listAdminNotifications({
      page: req.query.page,
      limit: req.query.limit,
      type: req.query.type,
      search: req.query.search,
      unreadOnly: req.query.unreadOnly
    });

    return res.status(200).json({
      status: "success",
      data
    });
  } catch (error) {
    next(error);
  }
}

async function readAdminNotification(req, res, next) {
  try {
    const notification = await markAdminNotificationRead(req.params.publicId);

    if (!notification) {
      return res.status(404).json({
        status: "error",
        message: "Admin notification not found"
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Admin notification marked as read",
      data: {
        notification
      }
    });
  } catch (error) {
    next(error);
  }
}

async function readAllAdminNotifications(_req, res, next) {
  try {
    const updatedCount = await markAllAdminNotificationsRead();

    return res.status(200).json({
      status: "success",
      message: "Admin notifications marked as read",
      data: {
        updatedCount
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAdminNotifications,
  getAdminSentAppNotifications,
  getMyNotifications,
  readAdminNotification,
  readAllAdminNotifications,
  readAllNotifications,
  readNotification,
  registerDevice,
  sendAdminAppNotification,
  sendTestNotification
};
