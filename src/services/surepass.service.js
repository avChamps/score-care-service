const env = require("../config/env");

function buildSurepassUrl(path) {
  const baseUrl = env.surepass.baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function fetchCibilCreditReport(payload) {
  if (!env.surepass.bearerToken) {
    const error = new Error("Surepass bearer token is required");
    error.statusCode = 503;
    throw error;
  }

  let response;

  try {
    response = await fetch(buildSurepassUrl(env.surepass.cibilReportPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.surepass.bearerToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (fetchError) {
    const error = new Error("Unable to connect to Surepass API");
    error.statusCode = 502;
    error.details = fetchError.cause?.message || fetchError.message;
    throw error;
  }

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok || responseBody.success === false) {
    const error = new Error(
      responseBody.message || "Failed to fetch CIBIL report from Surepass"
    );
    error.statusCode = response.ok ? 502 : response.status;
    error.details = responseBody;
    throw error;
  }

  return responseBody;
}

module.exports = {
  fetchCibilCreditReport
};
