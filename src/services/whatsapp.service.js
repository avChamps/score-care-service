const fs = require("fs");
const path = require("path");

const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  DisconnectReason,
  fetchLatestWaWebVersion,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const pino = require("pino");

const env = require("../config/env");

const AUTH_DIR = path.resolve(env.whatsapp.sessionDir);
let sock;
let isStarting = false;
let reconnectTimer = null;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

async function clearAuthDir() {
  await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
}

function shouldForceFreshLogin(statusCode) {
  return statusCode === DisconnectReason.loggedOut || statusCode === 405;
}

function scheduleReconnect({ forceFreshLogin = false, delayMs = 3000 } = {}) {
  clearReconnectTimer();
  reconnectTimer = setTimeout(async () => {
    if (forceFreshLogin) {
      await clearAuthDir();
    }

    await startWhatsApp();
  }, delayMs);
}

function normalizeWhatsappNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

function buildUserCreatedAlert(user) {
  return [
    "ScoreCare new user alert",
    "",
    `User ID: ${user.id}`,
    `Mobile: ${user.mobileNumber}`,
    `Name: ${user.fullName || "Not updated"}`,
    `PAN: ${user.panNumber || "Not updated"}`,
    `Email: ${user.email || "Not updated"}`,
    `Created: ${user.createdAt || new Date().toISOString()}`
  ].join("\n");
}

function buildUserLoginAlert(user, login = {}) {
  return [
    "ScoreCare user login alert",
    "",
    `User ID: ${user.id}`,
    `Mobile: ${user.mobileNumber}`,
    `Name: ${user.fullName || "Not updated"}`,
    `PAN: ${user.panNumber || "Not updated"}`,
    `Login method: ${login.loginMethod || "otp"}`,
    `IP: ${login.ipAddress || "Not available"}`,
    `Device ID: ${login.deviceId || "Not available"}`,
    `Logged in: ${login.loggedInAt || new Date().toISOString()}`
  ].join("\n");
}

async function startWhatsApp() {
  if (isStarting) {
    return sock;
  }

  isStarting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    let version;

    try {
      ({ version } = await fetchLatestWaWebVersion());
    } catch (_error) {
      version = undefined;
    }

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      version,
      printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
      if (connection === "open") {
        clearReconnectTimer();
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const forceFreshLogin = shouldForceFreshLogin(statusCode);

        scheduleReconnect({
          forceFreshLogin,
          delayMs: forceFreshLogin ? 1000 : 3000
        });
      }
    });

    return sock;
  } catch (_error) {
    scheduleReconnect({ forceFreshLogin: false, delayMs: 5000 });
    return sock;
  } finally {
    isStarting = false;
  }
}

async function sendWhatsappMessage(toNumber, message) {
  if (!env.whatsapp.enabled) {
    return {
      status: "skipped",
      reason: "WhatsApp alerts are disabled"
    };
  }

  const normalizedNumber = normalizeWhatsappNumber(toNumber);

  if (!normalizedNumber) {
    return {
      status: "skipped",
      reason: "WhatsApp alert number is missing"
    };
  }

  try {
    const socket = sock || await startWhatsApp();

    if (!socket) {
      return {
        status: "failed",
        reason: "WhatsApp socket is not ready"
      };
    }

    await socket.sendMessage(`${normalizedNumber}@s.whatsapp.net`, {
      text: message
    });

    return {
      status: "sent",
      to: normalizedNumber
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message
    };
  }
}

async function sendUserCreatedWhatsappAlert(user) {
  const toNumber = env.whatsapp.alertNumber || user.mobileNumber;

  return sendWhatsappMessage(toNumber, buildUserCreatedAlert(user));
}

async function sendUserLoginWhatsappAlert(user, login) {
  const toNumber = env.whatsapp.alertNumber || user.mobileNumber;

  return sendWhatsappMessage(toNumber, buildUserLoginAlert(user, login));
}

module.exports = {
  sendUserLoginWhatsappAlert,
  sendUserCreatedWhatsappAlert,
  startWhatsApp
};
