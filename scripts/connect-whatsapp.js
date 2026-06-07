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

const env = require("../src/config/env");

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
  try {
    await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
    console.log("[WA] Cleared auth directory for fresh login.");
  } catch (err) {
    console.error("[WA] Failed to clear auth directory:", err?.message || err);
  }
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
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

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
        console.log(`[WA] Connection closed: ${statusCode}`);

        if (forceFreshLogin) {
          console.log("[WA] Session invalid/expired. Regenerating QR.");
        }

        scheduleReconnect({
          forceFreshLogin,
          delayMs: forceFreshLogin ? 1000 : 3000
        });
      }
    });

    return sock;
  } catch (err) {
    console.error("[WA] Failed to start socket:", err?.message || err);
    scheduleReconnect({ forceFreshLogin: false, delayMs: 5000 });
    return sock;
  } finally {
    isStarting = false;
  }
}

startWhatsApp();
