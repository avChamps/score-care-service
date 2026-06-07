CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  mobile_number VARCHAR(15) NOT NULL,
  pan_number VARCHAR(10) NULL,
  full_name VARCHAR(150) NULL,
  email VARCHAR(255) NULL,
  date_of_birth DATE NULL,
  status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_mobile_number (mobile_number),
  UNIQUE KEY uq_users_pan_number (pan_number),
  KEY idx_users_last_login_at (last_login_at)
);

CREATE TABLE IF NOT EXISTS user_login_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  mobile_number VARCHAR(15) NOT NULL,
  pan_number VARCHAR(10) NULL,
  login_method ENUM('otp', 'password', 'google', 'manual') NOT NULL DEFAULT 'otp',
  login_status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  device_id VARCHAR(150) NULL,
  metadata JSON NULL,
  logged_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_login_events_user_id (user_id),
  KEY idx_user_login_events_logged_in_at (logged_in_at),
  CONSTRAINT fk_user_login_events_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
