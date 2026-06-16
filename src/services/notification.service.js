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
  const message = {
    token,
    notification: {
      title: payload.title || "",
      body: payload.body || ""
    },
    data: normalizeData(payload.data, payload.screen)
  };

  if (payload.imageUrl) {
    message.notification.imageUrl = payload.imageUrl;
    message.android = {
      notification: {
        imageUrl: payload.imageUrl
      }
    };
    message.apns = {
      payload: {
        aps: {
          "mutable-content": 1
        }
      },
      fcmOptions: {
        imageUrl: payload.imageUrl
      }
    };
  }

  return message;
}

function isInvalidTokenError(error) {
  return INVALID_TOKEN_ERROR_CODES.has(error?.code);
}

async function sendToTokens(tokens, payload) {
  const uniqueTokens = [
    ...new Set(
      tokens
        .map((token) => String(token || "").trim())
        .filter(Boolean)
    )
  ];

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

  for (const token of uniqueTokens) {
    try {
      await messaging.send(buildMessage(token, payload));
      successCount += 1;
    } catch (error) {
      failureCount += 1;

      if (isInvalidTokenError(error)) {
        invalidTokens.push(token);
      }
    }
  }

  const disabledCount = await disableFcmTokens(invalidTokens);

  return {
    successCount,
    failureCount,
    disabledCount
  };
}

async function sendToUser(userId, payload = {}) {
  const tokens = await listActiveFcmTokensByUserIds([userId]);

  return sendToTokens(tokens.map((token) => token.fcmToken), payload);
}

async function sendToMultipleUsers(userIds, payload = {}) {
  const tokens = await listActiveFcmTokensByUserIds(userIds);

  return sendToTokens(tokens.map((token) => token.fcmToken), payload);
}

async function sendToAllUsers(payload = {}) {
  const tokens = await listAllActiveFcmTokens();

  return sendToTokens(tokens.map((token) => token.fcmToken), payload);
}

module.exports = {
  sendToAllUsers,
  sendToMultipleUsers,
  sendToUser
};
