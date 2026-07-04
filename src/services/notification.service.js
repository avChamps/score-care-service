const { getMessaging } = require("./firebase.service");
const {
  disableFcmTokens,
  listActiveFcmTokensByUserIds,
  listAllActiveFcmTokens
} = require("../models/notification.model");

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/invalid-argument"
]);

const ALLOWED_PUSH_TYPES = new Set([
  "admin_app_notification",
  "cibil_report_updated",
  "inactive_user_reminder",
  "loan_applied",
  "loan_status_updated",
  "feedback_submitted",
  "free_tier_created",
  "first_time_user_welcome",
  "cibil_repair_request_created",
  "credit_repair_documents_uploaded",
  "credit_dispute_submitted",
  "credit_dispute_status_updated",
  "cibil_repair_request_updated",
  "subscription_renewal_reminder"
]);

function isAllowedPushPayload(payload = {}) {
  return isAllowedPushType(payload.data?.type);
}

function isAllowedPushType(type) {
  return ALLOWED_PUSH_TYPES.has(type);
}

function normalizeData(data = {}, screen) {
  return Object.entries({
    ...data,
    ...(screen ? { screen } : {})
  }).reduce((result, [key, value]) => {
    if (value !== undefined && value !== null) {
      result[key] = typeof value === "string" ? value : JSON.stringify(value);
    }

    return result;
  }, {});
}

function buildMessage(token, payload = {}) {
  const title = payload.title || "";
  const body = payload.body || "";
  const message = {
    token,
    notification: {
      title,
      body
    },
    data: normalizeData({
      title,
      body,
      ...payload.data
    }, payload.screen),
    android: {
      priority: "high",
      notification: {
        channelId: "scorecare_notifications",
        priority: "high",
        sound: "default"
      }
    },
    apns: {
      headers: {
        "apns-push-type": "alert",
        "apns-priority": "10"
      },
      payload: {
        aps: {
          alert: {
            title,
            body
          },
          sound: "default"
        }
      }
    }
  };

  if (payload.imageUrl) {
    message.notification.imageUrl = payload.imageUrl;
    message.android.notification.imageUrl = payload.imageUrl;
    message.apns.payload.aps["mutable-content"] = 1;
    message.apns.fcmOptions = {
      imageUrl: payload.imageUrl
    };
  }

  return message;
}

function isInvalidTokenError(error) {
  return INVALID_TOKEN_ERROR_CODES.has(error?.code);
}

function maskToken(token) {
  const value = String(token || "");

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function normalizeTokenRecords(tokens) {
  const tokenMap = new Map();

  for (const token of tokens) {
    const fcmToken = String(token?.fcmToken || token || "").trim();

    if (fcmToken && !tokenMap.has(fcmToken)) {
      tokenMap.set(fcmToken, typeof token === "object" ? token : { fcmToken });
    }
  }

  return [...tokenMap.values()];
}

async function sendToTokens(tokens, payload) {
  const uniqueTokens = normalizeTokenRecords(tokens);

  if (!uniqueTokens.length) {
    return {
      successCount: 0,
      failureCount: 0,
      disabledCount: 0
    };
  }

  const messaging = getMessaging();
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  for (const tokenRecord of uniqueTokens) {
    const token = tokenRecord.fcmToken;
    const logContext = {
      userId: tokenRecord.userId,
      tokenId: tokenRecord.id,
      platform: tokenRecord.platform,
      deviceId: tokenRecord.deviceId,
      token: maskToken(token),
      type: payload.data?.type,
      notificationId: payload.data?.notificationId
    };

    try {
      await messaging.send(buildMessage(token, payload));
      successCount += 1;
      console.info("[push-notification] sent", logContext);
    } catch (error) {
      failureCount += 1;
      console.error("[push-notification] failed", {
        ...logContext,
        code: error.code,
        message: error.message
      });

      if (isInvalidTokenError(error)) {
        invalidTokens.push(token);
      }
    }
  }

  const disabledCount = await disableFcmTokens(invalidTokens);

  if (disabledCount) {
    console.warn("[push-notification] disabled invalid tokens", {
      disabledCount,
      tokens: invalidTokens.map(maskToken)
    });
  }

  return {
    successCount,
    failureCount,
    disabledCount
  };
}

async function sendToUser(userId, payload = {}) {
  if (!isAllowedPushPayload(payload)) {
    return {
      successCount: 0,
      failureCount: 0,
      disabledCount: 0
    };
  }

  const tokens = await listActiveFcmTokensByUserIds([userId]);

  return sendToTokens(tokens, payload);
}

async function sendToMultipleUsers(userIds, payload = {}) {
  if (!isAllowedPushPayload(payload)) {
    return {
      successCount: 0,
      failureCount: 0,
      disabledCount: 0
    };
  }

  const tokens = await listActiveFcmTokensByUserIds(userIds);

  return sendToTokens(tokens, payload);
}

async function sendToAllUsers(payload = {}) {
  if (!isAllowedPushPayload(payload)) {
    return {
      successCount: 0,
      failureCount: 0,
      disabledCount: 0
    };
  }

  const tokens = await listAllActiveFcmTokens();

  return sendToTokens(tokens, payload);
}

module.exports = {
  isAllowedPushType,
  sendToAllUsers,
  sendToMultipleUsers,
  sendToUser
};
