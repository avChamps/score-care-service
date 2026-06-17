const fs = require("fs");
const path = require("path");

const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  DisconnectReason,
  fetchLatestWaWebVersion,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

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
    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log("[WA] Scan this QR:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        clearReconnectTimer();
        console.log("[WA] WhatsApp connected.");
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const forceFreshLogin = shouldForceFreshLogin(statusCode);
        console.log(`[WA] Connection closed: ${statusCode || "unknown"}`);

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

async function sendWhatsAppGroupMessage(message, user = null) {
  if (!env.whatsapp.enabled) {
    return {
      status: "skipped",
      reason: "WhatsApp alerts are disabled"
    };
  }

  const alertNumber = normalizeWhatsappNumber(env.whatsapp.alertNumber);
  const userNumber = normalizeWhatsappNumber(user?.mobileNumber);
  const recipient = env.whatsapp.groupJid ||
    (alertNumber ? `${alertNumber}@s.whatsapp.net` : "") ||
    (userNumber ? `${userNumber}@s.whatsapp.net` : "");

  if (!recipient) {
    return {
      status: "failed",
      reason: "WhatsApp alert recipient is not configured"
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

    await socket.sendMessage(recipient, {
      text: message
    });

    return {
      status: "sent",
      to: recipient
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message
    };
  }
}

async function sendWhatsAppAdminMessage(message) {
  if (!env.whatsapp.enabled) {
    return {
      status: "skipped",
      reason: "WhatsApp alerts are disabled"
    };
  }

  const alertNumber = normalizeWhatsappNumber(env.whatsapp.alertNumber);
  const recipient = env.whatsapp.groupJid || (alertNumber ? `${alertNumber}@s.whatsapp.net` : "");

  if (!recipient) {
    return {
      status: "skipped",
      reason: "WhatsApp admin recipient is not configured"
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

    await socket.sendMessage(recipient, {
      text: message
    });

    return {
      status: "sent",
      to: recipient
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error.message
    };
  }
}

async function sendWhatsAppUserMessage(user, message) {
  if (!env.whatsapp.enabled) {
    return {
      status: "skipped",
      reason: "WhatsApp alerts are disabled"
    };
  }

  const normalizedNumber = normalizeWhatsappNumber(user?.mobileNumber);

  if (!normalizedNumber) {
    return {
      status: "skipped",
      reason: "User WhatsApp number is missing"
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

async function sendWhatsAppSafely(handler) {
  try {
    return await handler();
  } catch (error) {
    return {
      status: "failed",
      reason: error.message
    };
  }
}

module.exports = {
  sendWhatsAppAdminMessage,
  sendWhatsAppUserMessage,
  sendWhatsAppSafely,
  startWhatsApp
};
