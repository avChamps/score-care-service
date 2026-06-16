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

function buildMessage(tokens, payload = {}) {
  const message = {
    tokens,
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

function collectInvalidTokens(batchTokens, responses) {
  return responses
    .map((response, index) => {
      const code = response.error?.code;
      return code && INVALID_TOKEN_ERROR_CODES.has(code) ? batchTokens[index] : null;
    })
    .filter(Boolean);
}

async function sendToTokens(tokens, payload) {
  const uniqueTokens = [...new Set(tokens.filter(Boolean))];

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

  for (let index = 0; index < uniqueTokens.length; index += 500) {
    const batchTokens = uniqueTokens.slice(index, index + 500);
    const response = await messaging.sendEachForMulticast(
      buildMessage(batchTokens, payload)
    );

    successCount += response.successCount;
    failureCount += response.failureCount;
    invalidTokens.push(...collectInvalidTokens(batchTokens, response.responses));
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
