const env = require("../config/env");

const otpStore = new Map();

function formatIndianMobileIdentifier(mobileNumber) {
  return `91${mobileNumber}`;
}

function generateOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function sendMobileOtp(mobileNumber) {
  const mobile = formatIndianMobileIdentifier(mobileNumber);

if (!env.msg91.flowId) {
  const error = new Error("MSG91 flow id is required");
  error.statusCode = 503;
  throw error;
}

  if (!env.msg91.enabled) {
    return {
      type: "success",
      message: "MSG91 OTP sending is disabled",
      provider: "mock",
      mobile
    };
  }

  if (!env.msg91.authKey) {
    const error = new Error("MSG91 auth key is required");
    error.statusCode = 503;
    throw error;
  }

  const otp = generateOtp(env.msg91.otpLength || 6);

  const response = await sendSmsWithTemplate(mobile, otp);

  otpStore.set(mobile, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  return response;
}

async function sendSmsWithTemplate(mobile, otp) {
  const response = await fetchMsg91(env.msg91.sendSmsUrl, {
    method: "POST",
    headers: {
      authkey: env.msg91.authKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      flow_id: env.msg91.flowId,
      short_url: "0",
      recipients: [
        {
          mobiles: mobile,
          OTP: otp
        }
      ]
    })
  });

  return parseMsg91Response(response);
}

async function verifyMobileOtp(mobileNumber, otp) {
  const mobile = formatIndianMobileIdentifier(mobileNumber);

  if (!env.msg91.enabled) {
    const error = new Error("MSG91 OTP verification is disabled");
    error.statusCode = 503;
    throw error;
  }

  const savedOtp = otpStore.get(mobile);

  if (!savedOtp) {
    const error = new Error("OTP expired or not found");
    error.statusCode = 400;
    throw error;
  }

  if (Date.now() > savedOtp.expiresAt) {
    otpStore.delete(mobile);
    const error = new Error("OTP expired");
    error.statusCode = 400;
    throw error;
  }

  if (savedOtp.otp !== otp) {
    const error = new Error("Invalid OTP");
    error.statusCode = 400;
    throw error;
  }

  otpStore.delete(mobile);

  return {
    type: "success",
    message: "OTP verified successfully"
  };
}

async function fetchMsg91(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const providerError = new Error("Unable to reach MSG91 SMS service");
    providerError.statusCode = 502;
    providerError.details = {
      provider: "MSG91",
      reason: error.message
    };
    throw providerError;
  }
}

async function parseMsg91Response(response) {
  const responseBody = await response.json().catch(() => ({}));

  const hasMsg91Error =
    responseBody.hasError === true ||
    responseBody.type === "error" ||
    responseBody.status === "fail";

  if (!response.ok || hasMsg91Error) {
    const error = new Error(responseBody.message || "Failed to send SMS through MSG91");
    error.statusCode = response.ok ? 502 : response.status;
    error.details = responseBody;
    throw error;
  }

  return responseBody;
}

module.exports = {
  sendMobileOtp,
  verifyMobileOtp
};
