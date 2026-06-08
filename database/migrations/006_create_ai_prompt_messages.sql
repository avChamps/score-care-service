CREATE TABLE IF NOT EXISTS ai_prompt_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  user_public_id VARCHAR(64) NULL,
  message TEXT NOT NULL,
  history JSON NULL,
  model VARCHAR(120) NULL,
  temperature DECIMAL(3,2) NULL,
  max_output_tokens INT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ai_prompt_messages_user_id (user_id),
  KEY idx_ai_prompt_messages_created_at (created_at),
  CONSTRAINT fk_ai_prompt_messages_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);
