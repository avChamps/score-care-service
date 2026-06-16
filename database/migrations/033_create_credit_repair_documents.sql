CREATE TABLE IF NOT EXISTS credit_repair_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  credit_report_id VARCHAR(80) NULL,
  account_number VARCHAR(80) NOT NULL,
  account_type VARCHAR(120) NOT NULL,
  bank_name VARCHAR(255) NULL,
  issue_type VARCHAR(255) NULL,
  document_type VARCHAR(120) NOT NULL,
  document_url TEXT NOT NULL,
  closing_date DATE NULL,
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_credit_repair_documents_user_id (user_id),
  KEY idx_credit_repair_documents_credit_report_id (credit_report_id),
  KEY idx_credit_repair_documents_account_number (account_number),
  CONSTRAINT fk_credit_repair_documents_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
