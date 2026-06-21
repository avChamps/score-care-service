CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  user_public_id CHAR(36) NOT NULL,
  user_name VARCHAR(150) NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  amount DECIMAL(10,2) NULL,
  currency VARCHAR(3) NULL,
  reference_type VARCHAR(80) NOT NULL,
  reference_id VARCHAR(120) NOT NULL,
  notification_key VARCHAR(200) NOT NULL,
  data JSON NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_notifications_public_id (public_id),
  UNIQUE KEY uq_admin_notifications_key (notification_key),
  KEY idx_admin_notifications_created_at (created_at),
  KEY idx_admin_notifications_read_at (read_at),
  KEY idx_admin_notifications_type (type),
  KEY idx_admin_notifications_user_public_id (user_public_id),
  CONSTRAINT fk_admin_notifications_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
);
