const env = require("../config/env");

function formatIndianMobileIdentifier(mobileNumber) {
  return `91${mobileNumber}`;
}

async function sendMobileOtp(mobileNumber) {
  if (!env.msg91.enabled) {
    return {
      type: "success",
      message: "MSG91 OTP sending is disabled; use the configured test OTP",
      provider: "mock",
      mobile: formatIndianMobileIdentifier(mobileNumber)
    };
  }

  if (!env.msg91.authKey) {
    const error = new Error("MSG91 auth key is required");
    error.statusCode = 503;
    throw error;
  }

  if (!env.msg91.templateId) {
    const error = new Error("MSG91 template id is required for server-side OTP");
    error.statusCode = 503;
    throw error;
  }

  return sendOtpWithTemplate(mobileNumber);
}

async function sendOtpWithTemplate(mobileNumber) {
  const url = new URL(env.msg91.sendOtpUrl);

  url.searchParams.set("template_id", env.msg91.templateId);
  url.searchParams.set("mobile", formatIndianMobileIdentifier(mobileNumber));
  url.searchParams.set("authkey", env.msg91.authKey);
  url.searchParams.set("otp_length", String(env.msg91.otpLength));

  const response = await fetchMsg91(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({})
  });

  return parseMsg91Response(response);
}

async function verifyMobileOtp(mobileNumber, otp) {
  if (!env.msg91.enabled) {
    const error = new Error("MSG91 OTP verification is disabled; use the configured test OTP");
    error.statusCode = 503;
    error.details = {
      provider: "mock",
      mobile: formatIndianMobileIdentifier(mobileNumber)
    };
    throw error;
  }

  if (!env.msg91.authKey) {
    const error = new Error("MSG91 auth key is required");
    error.statusCode = 503;
    throw error;
  }

  const url = new URL("https://control.msg91.com/api/v5/otp/verify");

  url.searchParams.set("otp", otp);
  url.searchParams.set("mobile", formatIndianMobileIdentifier(mobileNumber));

  const response = await fetchMsg91(url, {
    method: "GET",
    headers: {
      authkey: env.msg91.authKey
    }
  });

  return parseMsg91Response(response);
}

async function fetchMsg91(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    const cause = error.cause || error;
    const providerError = new Error("Unable to reach MSG91 OTP service");

    providerError.statusCode = 502;
    providerError.details = {
      provider: "MSG91",
      url: `${url.origin}${url.pathname}`,
      reason: cause.code || error.message,
      message: cause.message || error.message
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
    const error = new Error(responseBody.message || "Failed to send OTP through MSG91");
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
