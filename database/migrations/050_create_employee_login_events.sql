CREATE TABLE IF NOT EXISTS employee_login_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  employee_public_id CHAR(36) NOT NULL,
  mobile_number VARCHAR(15) NOT NULL,
  login_method ENUM('otp_totp') NOT NULL DEFAULT 'otp_totp',
  login_status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  device_id VARCHAR(150) NULL,
  metadata JSON NULL,
  logged_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logged_out_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_employee_login_events_employee_id (employee_id),
  KEY idx_employee_login_events_logged_in_at (logged_in_at),
  KEY idx_employee_login_events_logged_out_at (logged_out_at),
  CONSTRAINT fk_employee_login_events_employee_id
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
);
