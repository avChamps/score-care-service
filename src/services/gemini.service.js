const env = require("../config/env");

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildGeminiUrl(model) {
  const baseUrl = env.gemini.baseUrl.replace(/\/+$/, "");
  const normalizedModel = String(model || env.gemini.model).replace(
    /^models\//,
    ""
  );
  const encodedModel = encodeURIComponent(normalizedModel);

  return `${baseUrl}/models/${encodedModel}:generateContent`;
}

function normalizeContents({ message, history = [] }) {
  const contents = history.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  return contents;
}

function extractText(responseBody) {
  return (responseBody.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildGeminiError(response, responseBody) {
  const error = new Error(
    responseBody.error?.message || "Failed to generate Gemini answer"
  );
  error.statusCode = response.ok ? 502 : response.status;
  error.details = responseBody;
  return error;
}

async function requestGemini({ model, payload }) {
  let lastError;
  const maxAttempts = Math.max(1, env.gemini.maxAttempts);
  const retryDelayMs = Math.max(0, env.gemini.retryDelayMs);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;

    try {
      response = await fetch(buildGeminiUrl(model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.gemini.apiKey
        },
        body: JSON.stringify(payload)
      });
    } catch (fetchError) {
      const error = new Error("Unable to connect to Gemini API");
      error.statusCode = 502;
      error.details = fetchError.cause?.message || fetchError.message;
      lastError = error;
    }

    if (response) {
      const responseBody = await response.json().catch(() => ({}));

      if (response.ok && !responseBody.error) {
        return responseBody;
      }

      lastError = buildGeminiError(response, responseBody);
    }

    if (
      attempt === maxAttempts ||
      !retryableStatuses.has(lastError.statusCode)
    ) {
      throw lastError;
    }

    await wait(retryDelayMs * attempt);
  }

  throw lastError;
}

async function generateGeminiAnswer({
  message,
  history,
  model,
  temperature,
  maxOutputTokens
}) {
  if (!env.gemini.apiKey) {
    const error = new Error("Gemini API key is required");
    error.statusCode = 503;
    throw error;
  }

  const generationConfig = {};

  if (temperature !== undefined) {
    generationConfig.temperature = temperature;
  }

  if (maxOutputTokens !== undefined) {
    generationConfig.maxOutputTokens = maxOutputTokens;
  }

  const payload = {
    contents: normalizeContents({ message, history })
  };

  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  const responseBody = await requestGemini({ model, payload });

  const answer = extractText(responseBody);

  if (!answer) {
    const error = new Error("Gemini returned an empty answer");
    error.statusCode = 502;
    error.details = responseBody;
    throw error;
  }

  return {
    answer,
    model: model || env.gemini.model,
    usageMetadata: responseBody.usageMetadata || null
  };
}

module.exports = {
  generateGeminiAnswer
};
