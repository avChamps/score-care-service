const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  jwt: {
    secret: process.env.JWT_SECRET || "change-this-scorecare-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  },
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY || "",
    widgetId: process.env.MSG91_WIDGET_ID || "",
    templateId: process.env.MSG91_TEMPLATE_ID || "",
    otpLength: Number(process.env.MSG91_OTP_LENGTH || 6),
    testOtp: process.env.MSG91_TEST_OTP || "",
    sendOtpUrl:
      process.env.MSG91_SEND_OTP_URL ||
      "https://control.msg91.com/api/v5/otp"
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
