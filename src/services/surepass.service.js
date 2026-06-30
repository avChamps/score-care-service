const env = require("../config/env");
const {
  createCreditBureauApiHit
} = require("../models/credit-bureau-api-hit.model");

function buildSurepassUrl(path) {
  const baseUrl = env.surepass.baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function saveApiHit(values) {
  try {
    await createCreditBureauApiHit(values);
  } catch (error) {
    console.error("Unable to save credit bureau API hit:", error.message);
  }
}

function getSurepassErrorStatus(response) {
  if (response.ok) {
    return 502;
  }

  if (response.status === 401 || response.status === 403) {
    return 502;
  }

  return response.status;
}

async function postSurepass(path, payload, errorMessage, tracking) {
  if (!env.surepass.bearerToken) {
    const error = new Error("Surepass bearer token is required");
    error.statusCode = 503;
    throw error;
  }

  let response;
  const endpoint = buildSurepassUrl(path);
  const startedAt = Date.now();

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.surepass.bearerToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (fetchError) {
    await saveApiHit({
      ...tracking,
      endpoint,
      requestPayload: payload,
      responsePayload: null,
      success: false,
      httpStatus: null,
      errorMessage: fetchError.cause?.message || fetchError.message,
      durationMs: Date.now() - startedAt
    });

    const error = new Error("Unable to connect to Surepass API");
    error.statusCode = 502;
    error.details = fetchError.cause?.message || fetchError.message;
    throw error;
  }

  const responseBody = await response.json().catch(() => ({}));
  const success = response.ok && responseBody.success !== false;

  await saveApiHit({
    ...tracking,
    endpoint,
    requestPayload: payload,
    responsePayload: responseBody,
    success,
    httpStatus: response.status,
    errorMessage: success ? null : responseBody.message || errorMessage,
    durationMs: Date.now() - startedAt
  });

  if (!success) {
    const error = new Error(
      responseBody.message || errorMessage
    );
    error.statusCode = getSurepassErrorStatus(response);
    error.details = responseBody;
    throw error;
  }

  return responseBody;
}

async function fetchCibilCreditReport(payload, context = {}) {
  return postSurepass(
    env.surepass.cibilReportPath,
    payload,
    "Failed to fetch CIBIL report from Surepass",
    {
      bureauType: "cibil",
      operationType: "report_data",
      ...context
    }
  );
}

async function fetchCrifCreditScore(payload, context = {}) {
  return postSurepass(
    env.surepass.crifScorePath,
    payload,
    "Failed to fetch CRIF credit score from Surepass",
    {
      bureauType: "crif",
      operationType: "score",
      ...context
    }
  );
}

async function fetchCrifCreditReport(payload, context = {}) {
  return postSurepass(
    env.surepass.crifReportPath,
    payload,
    "Failed to fetch CRIF credit report from Surepass",
    {
      bureauType: "crif",
      operationType: "report_data",
      ...context
    }
  );
}

async function fetchManualCreditReportPdf(type, payload, context = {}) {
  const paths = {
    experian: env.surepass.experianReportPdfPath,
    cibil: env.surepass.cibilReportPath,
    crif: env.surepass.crifReportPdfPath
  };
  const reportPath = paths[type];

  if (!reportPath) {
    const error = new Error("Invalid credit bureau type");
    error.statusCode = 400;
    throw error;
  }

  return postSurepass(
    reportPath,
    payload,
    `Failed to fetch ${type.toUpperCase()} report from Surepass`,
    {
      bureauType: type,
      operationType: "manual_report_download",
      ...context
    }
  );
}

module.exports = {
  fetchCibilCreditReport,
  fetchCrifCreditReport,
  fetchCrifCreditScore,
  fetchManualCreditReportPdf,
};
