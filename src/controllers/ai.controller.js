const {
  generateGeminiAnswer,
  streamGeminiAnswer
} = require("../services/gemini.service");
const {
  createAiPromptMessage
} = require("../models/ai-prompt-message.model");

const allowedRoles = new Set(["user", "model"]);

function validateNumber(value, fieldName, errors, { min, max }) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    errors.push(`${fieldName} must be a number between ${min} and ${max}`);
    return undefined;
  }

  return number;
}

function validateHistory(history, errors) {
  if (history === undefined) {
    return [];
  }

  if (!Array.isArray(history)) {
    errors.push("history must be an array");
    return [];
  }

  return history
    .map((item) => ({
      role: String(item?.role || "").trim(),
      text: String(item?.text || item?.message || "").trim()
    }))
    .filter((item, index) => {
      if (!allowedRoles.has(item.role)) {
        errors.push(`history[${index}].role must be user or model`);
        return false;
      }

      if (!item.text) {
        errors.push(`history[${index}].text is required`);
        return false;
      }

      return true;
    });
}

function validateGeminiPayload(body) {
  const errors = [];
  const message = String(body.message || body.prompt || "").trim();
  const rawTaId = body.ta_id ?? body.taId ?? body.table_id ?? body.tableId ?? body.tableid;
  const taId = rawTaId ? String(rawTaId).trim() : null;
  const model = body.model ? String(body.model).trim() : undefined;
  const history = validateHistory(body.history, errors);
  const temperature = validateNumber(body.temperature, "temperature", errors, {
    min: 0,
    max: 2
  });
  const maxOutputTokens = validateNumber(
    body.maxOutputTokens,
    "maxOutputTokens",
    errors,
    { min: 1, max: 8192 }
  );

  if (!message) {
    errors.push("message is required");
  }

  return {
    errors,
    value: {
      taId,
      message,
      history,
      model,
      temperature,
      maxOutputTokens
    }
  };
}

async function savePromptMessage(req, prompt) {
  try {
    return await createAiPromptMessage({
      userId: req.auth?.internalUserId || null,
      userPublicId: req.auth?.userId || null,
      taId: prompt.taId,
      message: prompt.message,
      history: prompt.history,
      model: prompt.model,
      temperature: prompt.temperature,
      maxOutputTokens: prompt.maxOutputTokens,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });
  } catch (error) {
    console.error("Failed to save AI prompt message:", error.message);
    return null;
  }
}

async function askGemini(req, res, next) {
  try {
    const { errors, value } = validateGeminiPayload(req.body || {});

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const promptMessageId = await savePromptMessage(req, value);
    const result = await generateGeminiAnswer(value);

    return res.status(200).json({
      status: "success",
      data: {
        ...result,
        promptMessageId
      }
    });
  } catch (error) {
    next(error);
  }
}

function writeSseEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamGemini(req, res, next) {
  const abortController = new AbortController();
  let streamStarted = false;

  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    const { errors, value } = validateGeminiPayload(req.body || {});

    if (errors.length > 0) {
      return res.status(400).json({
        status: "error",
        errors
      });
    }

    const promptMessageId = await savePromptMessage(req, value);

    res.status(200);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders?.();
    streamStarted = true;

    writeSseEvent(res, "metadata", {
      status: "streaming",
      model: value.model,
      promptMessageId
    });

    let answer = "";
    let usageMetadata = null;

    for await (const chunk of streamGeminiAnswer({
      ...value,
      signal: abortController.signal
    })) {
      if (abortController.signal.aborted) {
        return;
      }

      if (chunk.text) {
        answer += chunk.text;
        writeSseEvent(res, "chunk", { text: chunk.text });
      }

      if (chunk.usageMetadata) {
        usageMetadata = chunk.usageMetadata;
      }
    }

    writeSseEvent(res, "done", {
      status: "success",
      answer,
      usageMetadata,
      promptMessageId
    });
    return res.end();
  } catch (error) {
    if (abortController.signal.aborted) {
      return;
    }

    if (streamStarted) {
      writeSseEvent(res, "error", {
        status: "error",
        message: error.message,
        details:
          process.env.NODE_ENV === "production"
            ? undefined
            : error.details || error.message
      });
      return res.end();
    }

    return next(error);
  }
}

module.exports = {
  askGemini,
  streamGemini
};
