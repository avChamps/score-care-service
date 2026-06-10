const env = require("../config/env");

function buildSurepassUrl(path) {
  const baseUrl = env.surepass.baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function postSurepass(path, payload, errorMessage) {
  if (!env.surepass.bearerToken) {
    const error = new Error("Surepass bearer token is required");
    error.statusCode = 503;
    throw error;
  }

  let response;

  try {
    response = await fetch(buildSurepassUrl(path), {
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
      responseBody.message || errorMessage
    );
    error.statusCode = response.ok ? 502 : response.status;
    error.details = responseBody;
    throw error;
  }

  return responseBody;
}

async function fetchCibilCreditReport(payload) {
  return postSurepass(
    env.surepass.cibilReportPath,
    payload,
    "Failed to fetch CIBIL report from Surepass"
  );
}

async function fetchExperianCreditScore(payload) {
  return postSurepass(
    env.surepass.experianScorePath,
    payload,
    "Failed to fetch Experian credit score from Surepass"
  );
}

async function fetchExperianCreditReport(payload) {
  return postSurepass(
    env.surepass.experianReportPath,
    payload,
    "Failed to fetch Experian credit report from Surepass"
  );
}

module.exports = {
  fetchCibilCreditReport,
  fetchExperianCreditReport,
  fetchExperianCreditScore
};
