const crypto = require("crypto");

const env = require("../config/env");

function getRazorpayCredentials() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    const error = new Error("Razorpay credentials are not configured");
    error.statusCode = 500;
    throw error;
  }

  return env.razorpay;
}

async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  const credentials = getRazorpayCredentials();
  const auth = Buffer.from(
    `${credentials.keyId}:${credentials.keySecret}`
  ).toString("base64");
  const response = await fetch(`${credentials.baseUrl}/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Math.round(Number(amount) * 100),
      currency,
      receipt,
      notes
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.description || "Unable to create Razorpay order");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function createRazorpaySubscription({
  planId,
  totalCount,
  customerNotify,
  notes
}) {
  const credentials = getRazorpayCredentials();
  const auth = Buffer.from(
    `${credentials.keyId}:${credentials.keySecret}`
  ).toString("base64");
  const response = await fetch(`${credentials.baseUrl}/v1/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: totalCount,
      customer_notify: customerNotify ? 1 : 0,
      notes
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.description || "Unable to create Razorpay subscription");
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

function verifyRazorpaySubscriptionSignature({
  razorpayPaymentId,
  razorpaySubscriptionId,
  razorpaySignature
}) {
  const credentials = getRazorpayCredentials();
  const expectedSignature = crypto
    .createHmac("sha256", credentials.keySecret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(razorpaySignature || "");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyRazorpayWebhookSignature({ rawBody, razorpaySignature }) {
  const credentials = getRazorpayCredentials();

  if (!credentials.webhookSecret) {
    const error = new Error("Razorpay webhook secret is not configured");
    error.statusCode = 500;
    throw error;
  }

  const expectedSignature = crypto
    .createHmac("sha256", credentials.webhookSecret)
    .update(rawBody || Buffer.from(""))
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(razorpaySignature || "");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function verifyRazorpayPaymentSignature({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}) {
  const credentials = getRazorpayCredentials();
  const expectedSignature = crypto
    .createHmac("sha256", credentials.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(razorpaySignature || "");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

module.exports = {
  createRazorpayOrder,
  createRazorpaySubscription,
  getRazorpayCredentials,
  verifyRazorpayPaymentSignature,
  verifyRazorpaySubscriptionSignature,
  verifyRazorpayWebhookSignature
};
