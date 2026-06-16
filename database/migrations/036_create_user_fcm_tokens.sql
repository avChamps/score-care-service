CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  fcm_token TEXT NOT NULL,
  platform VARCHAR(30) DEFAULT 'android',
  device_id VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  KEY idx_user_fcm_tokens_user_id(user_id),
  KEY idx_user_fcm_tokens_is_active(is_active),
  CONSTRAINT fk_user_fcm_tokens_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
