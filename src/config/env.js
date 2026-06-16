const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  jwt: {
    secret: process.env.JWT_SECRET || "change-this-scorecare-secret"
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    baseUrl: process.env.RAZORPAY_BASE_URL || "https://api.razorpay.com"
  },
msg91: {
  authKey: process.env.MSG91_AUTH_KEY,
  enabled: process.env.MSG91_ENABLED === "true",
  flowId: process.env.MSG91_FLOW_ID,
  otpLength: Number(process.env.MSG91_OTP_LENGTH || 6),
  sendSmsUrl: process.env.MSG91_SEND_SMS_URL
},
  assets: {
    storageDriver: process.env.ASSETS_STORAGE_DRIVER || "local",
    rootDir: process.env.ASSETS_ROOT_DIR || "/var/www/scorecare-assets",
    publicBaseUrl:
      process.env.ASSETS_PUBLIC_BASE_URL ||
      "https://scorecareapp.com/assets",
    sftp: {
      host: process.env.ASSETS_SFTP_HOST || "",
      port: Number(process.env.ASSETS_SFTP_PORT || 22),
      username: process.env.ASSETS_SFTP_USERNAME || "",
      password: process.env.ASSETS_SFTP_PASSWORD || "",
      privateKeyPath: process.env.ASSETS_SFTP_PRIVATE_KEY_PATH || "",
      rootDir:
        process.env.ASSETS_SFTP_ROOT_DIR ||
        process.env.ASSETS_ROOT_DIR ||
        "/var/www/scorecare-assets"
    }
  },
  notifications: {
    monthlyCibilEnabled:
      process.env.MONTHLY_CIBIL_NOTIFICATION_ENABLED !== "false",
    monthlyCibilCron:
      process.env.MONTHLY_CIBIL_NOTIFICATION_CRON || "0 9 1 * *",
    timezone: process.env.NOTIFICATION_TIMEZONE || "Asia/Kolkata"
  },
  whatsapp: {
    enabled: process.env.WHATSAPP_ALERT_ENABLED === "true",
    alertNumber: (process.env.WHATSAPP_ALERT_NUMBER || "").trim(),
    sessionDir: process.env.WHATSAPP_SESSION_DIR || "whatsapp-session"
  },
  smtp: {
    host: process.env.SMTP_HOST || "smtp.titan.email",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : true,
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASSWORD || "",
    fromName: process.env.SMTP_FROM_NAME || "ScoreCare"
  },
  surepass: {
    baseUrl: process.env.SUREPASS_BASE_URL || "https://sandbox.surepass.io",
    bearerToken: process.env.SUREPASS_BEARER_TOKEN || "",
    cibilReportPath:
      process.env.SUREPASS_CIBIL_REPORT_PATH ||
      "/api/v1/credit-report-cibil/fetch-report-pdf",
    crifScorePath:
      process.env.SUREPASS_CRIF_SCORE_PATH ||
      "/api/v1/credit-report-crif/score",
    crifReportPath:
      process.env.SUREPASS_CRIF_REPORT_PATH ||
      "/api/v1/credit-report-crif/fetch-report"
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    baseUrl:
      process.env.GEMINI_BASE_URL ||
      "https://generativelanguage.googleapis.com/v1beta",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    maxAttempts: Number(process.env.GEMINI_MAX_ATTEMPTS || 6),
    retryDelayMs: Number(process.env.GEMINI_RETRY_DELAY_MS || 1000)
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "scorecare",
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  }
};

module.exports = env;
