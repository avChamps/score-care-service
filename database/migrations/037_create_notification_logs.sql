CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  reference_type VARCHAR(80) NOT NULL,
  reference_id VARCHAR(120) NOT NULL,
  recipient_mobile VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
  provider_response JSON NULL,
  scheduled_for DATE NOT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_logs_dedupe (
    user_id,
    notification_type,
    reference_type,
    reference_id,
    scheduled_for
  ),
  KEY idx_notification_logs_user_id (user_id),
  KEY idx_notification_logs_type_status (notification_type, status),
  KEY idx_notification_logs_scheduled_for (scheduled_for),
  CONSTRAINT fk_notification_logs_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
