CREATE TABLE IF NOT EXISTS loan_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  user_public_id CHAR(36) NOT NULL,
  loan_amount DECIMAL(15,2) NOT NULL,
  loan_type VARCHAR(100) NOT NULL,
  employment_type VARCHAR(100) NOT NULL,
  monthly_income DECIMAL(15,2) NOT NULL,
  work_experience VARCHAR(100) NOT NULL,
  documents JSON NOT NULL,
  status ENUM('submitted', 'in_review', 'approved', 'rejected') NOT NULL DEFAULT 'submitted',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_loan_applications_user_id (user_id),
  KEY idx_loan_applications_user_public_id (user_public_id),
  KEY idx_loan_applications_status (status),
  CONSTRAINT fk_loan_applications_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
