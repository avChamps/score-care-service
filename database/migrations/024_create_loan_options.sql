CREATE TABLE IF NOT EXISTS loan_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL,
  option_type ENUM('loan_type', 'employment_type') NOT NULL,
  label VARCHAR(120) NOT NULL,
  value VARCHAR(120) NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loan_options_public_id (public_id),
  UNIQUE KEY uq_loan_options_type_value (option_type, value),
  KEY idx_loan_options_active_order (is_active, option_type, display_order)
);

INSERT INTO loan_options (
  public_id,
  option_type,
  label,
  value,
  display_order,
  is_active
)
VALUES
  (UUID(), 'loan_type', 'Personal Loan', 'personal', 1, 1),
  (UUID(), 'employment_type', 'Salaried', 'salaried', 1, 1),
  (UUID(), 'employment_type', 'Self Employed', 'self_employed', 2, 1),
  (UUID(), 'employment_type', 'Business Owner', 'business_owner', 3, 1),
  (UUID(), 'employment_type', 'Professional', 'professional', 4, 1)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  display_order = VALUES(display_order),
  is_active = VALUES(is_active);
