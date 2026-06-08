const {
  generateGeminiAnswer
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

module.exports = {
  askGemini
};
