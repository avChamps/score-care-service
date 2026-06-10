ALTER TABLE ai_prompt_messages
  ADD COLUMN ta_id VARCHAR(64) NULL AFTER user_public_id,
  ADD KEY idx_ai_prompt_messages_ta_id (ta_id);
