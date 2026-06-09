CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  user_public_id CHAR(36) NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  data JSON NULL,
  notification_key VARCHAR(180) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_user_key (user_id, notification_key),
  UNIQUE KEY uq_notifications_user_public_key (user_public_id, notification_key),
  KEY idx_notifications_user_id_created_at (user_id, created_at),
  KEY idx_notifications_user_id_read_at (user_id, read_at),
  KEY idx_notifications_user_public_id_created_at (user_public_id, created_at),
  KEY idx_notifications_user_public_id_read_at (user_public_id, read_at),
  KEY idx_notifications_type (type),
  CONSTRAINT fk_notifications_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

ALTER TABLE notifications
  ADD UNIQUE KEY uq_notifications_user_public_key (user_public_id, notification_key);

ALTER TABLE notifications
  ADD KEY idx_notifications_user_public_id_created_at (user_public_id, created_at);

ALTER TABLE notifications
  ADD KEY idx_notifications_user_public_id_read_at (user_public_id, read_at);
