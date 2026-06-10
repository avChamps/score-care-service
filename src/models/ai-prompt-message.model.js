const { pool } = require("../config/db");

async function createAiPromptMessage(prompt) {
  const [result] = await pool.query(
    `INSERT INTO ai_prompt_messages (
      user_id,
      user_public_id,
      ta_id,
      message,
      history,
      model,
      temperature,
      max_output_tokens,
      ip_address,
      user_agent
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      prompt.userId || null,
      prompt.userPublicId || null,
      prompt.taId || null,
      prompt.message,
      prompt.history && prompt.history.length > 0
        ? JSON.stringify(prompt.history)
        : null,
      prompt.model || null,
      prompt.temperature ?? null,
      prompt.maxOutputTokens ?? null,
      prompt.ipAddress || null,
      prompt.userAgent || null
    ]
  );

  return result.insertId;
}

module.exports = {
  createAiPromptMessage
};
