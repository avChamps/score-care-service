CREATE TABLE IF NOT EXISTS manual_credit_report_downloads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  bureau_type ENUM('experian', 'cibil', 'crif') NOT NULL,
  client_id VARCHAR(150) NOT NULL,
  name VARCHAR(200) NULL,
  first_name VARCHAR(100) NULL,
  last_name VARCHAR(100) NULL,
  mobile VARCHAR(15) NOT NULL,
  pan VARCHAR(10) NOT NULL,
  gender VARCHAR(20) NULL,
  credit_score VARCHAR(10) NULL,
  credit_report JSON NULL,
  credit_report_link TEXT NOT NULL,
  credit_report_base64 LONGTEXT NOT NULL,
  request_payload JSON NOT NULL,
  provider_response JSON NOT NULL,
  provider_status_code INT NULL,
  provider_message VARCHAR(255) NULL,
  provider_message_code VARCHAR(100) NULL,
  downloaded_by_user_id BIGINT UNSIGNED NULL,
  downloaded_by_employee_id BIGINT UNSIGNED NULL,
  downloaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_manual_credit_report_downloads_public_id (public_id),
  KEY idx_manual_credit_report_downloads_client_id (client_id),
  KEY idx_manual_credit_report_downloads_bureau_date (bureau_type, downloaded_at),
  KEY idx_manual_credit_report_downloads_mobile (mobile),
  KEY idx_manual_credit_report_downloads_pan (pan),
  CONSTRAINT fk_manual_credit_report_downloads_user_id
    FOREIGN KEY (downloaded_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_manual_credit_report_downloads_employee_id
    FOREIGN KEY (downloaded_by_employee_id) REFERENCES employees(id)
    ON DELETE SET NULL
);
