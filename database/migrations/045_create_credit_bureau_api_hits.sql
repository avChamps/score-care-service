CREATE TABLE IF NOT EXISTS credit_bureau_api_hits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  bureau_type ENUM('experian', 'cibil', 'crif') NOT NULL,
  operation_type ENUM('score', 'report_data', 'manual_report_download') NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  http_method VARCHAR(10) NOT NULL DEFAULT 'POST',
  mobile VARCHAR(15) NULL,
  pan VARCHAR(10) NULL,
  client_id VARCHAR(150) NULL,
  request_payload JSON NOT NULL,
  response_payload JSON NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  http_status INT NULL,
  error_message TEXT NULL,
  duration_ms INT UNSIGNED NOT NULL DEFAULT 0,
  requested_by_user_id BIGINT UNSIGNED NULL,
  requested_by_employee_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_credit_bureau_api_hits_public_id (public_id),
  KEY idx_credit_bureau_api_hits_bureau_created (bureau_type, created_at),
  KEY idx_credit_bureau_api_hits_operation_created (operation_type, created_at),
  KEY idx_credit_bureau_api_hits_success_created (success, created_at),
  KEY idx_credit_bureau_api_hits_mobile (mobile),
  KEY idx_credit_bureau_api_hits_pan (pan),
  CONSTRAINT fk_credit_bureau_api_hits_user_id
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_credit_bureau_api_hits_employee_id
    FOREIGN KEY (requested_by_employee_id) REFERENCES employees(id)
    ON DELETE SET NULL
);
