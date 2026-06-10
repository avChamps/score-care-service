const env = require("../config/env");

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildGeminiUrl(model, action = "generateContent", params = {}) {
  const baseUrl = env.gemini.baseUrl.replace(/\/+$/, "");
  const normalizedModel = String(model || env.gemini.model).replace(
    /^models\//,
    ""
  );
  const encodedModel = encodeURIComponent(normalizedModel);
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";

  return `${baseUrl}/models/${encodedModel}:${action}${suffix}`;
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

function extractTextChunk(responseBody) {
  return (responseBody.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text)
    .filter(Boolean)
    .join("");
}

function buildGeminiPayload({
  message,
  history,
  temperature,
  maxOutputTokens
}) {
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

  return payload;
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

async function parseGeminiErrorResponse(response) {
  const responseText = await response.text().catch(() => "");
  let responseBody = {};

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch (_error) {
      responseBody = { error: { message: responseText } };
    }
  }

  return buildGeminiError(response, responseBody);
}

async function* readGeminiSse(response) {
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines = [];

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line) {
        if (dataLines.length > 0) {
          yield dataLines.join("\n");
          dataLines = [];
        }
        continue;
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.startsWith("data:")) {
    dataLines.push(buffer.slice(5).trimStart());
  }

  if (dataLines.length > 0) {
    yield dataLines.join("\n");
  }
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

  const payload = buildGeminiPayload({
    message,
    history,
    temperature,
    maxOutputTokens
  });

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

async function* streamGeminiAnswer({
  message,
  history,
  model,
  temperature,
  maxOutputTokens,
  signal
}) {
  if (!env.gemini.apiKey) {
    const error = new Error("Gemini API key is required");
    error.statusCode = 503;
    throw error;
  }

  const payload = buildGeminiPayload({
    message,
    history,
    temperature,
    maxOutputTokens
  });

  let response;

  try {
    response = await fetch(
      buildGeminiUrl(model, "streamGenerateContent", { alt: "sse" }),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.gemini.apiKey
        },
        body: JSON.stringify(payload),
        signal
      }
    );
  } catch (fetchError) {
    if (signal?.aborted) {
      return;
    }

    const error = new Error("Unable to connect to Gemini API");
    error.statusCode = 502;
    error.details = fetchError.cause?.message || fetchError.message;
    throw error;
  }

  if (!response.ok) {
    throw await parseGeminiErrorResponse(response);
  }

  for await (const eventData of readGeminiSse(response)) {
    if (eventData === "[DONE]") {
      return;
    }

    const responseBody = JSON.parse(eventData);

    if (responseBody.error) {
      throw buildGeminiError(response, responseBody);
    }

    yield {
      text: extractTextChunk(responseBody),
      raw: responseBody,
      usageMetadata: responseBody.usageMetadata || null
    };
  }
}

module.exports = {
  generateGeminiAnswer,
  streamGeminiAnswer
};
