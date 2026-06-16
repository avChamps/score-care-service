CREATE TABLE IF NOT EXISTS cibil_repair_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL,
  plan_name VARCHAR(120) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  billing_cycle VARCHAR(40) NULL,
  button_label VARCHAR(120) NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cibil_repair_plans_public_id (public_id),
  UNIQUE KEY uq_cibil_repair_plans_plan_name (plan_name),
  KEY idx_cibil_repair_plans_active_order (is_active, display_order)
);

CREATE TABLE IF NOT EXISTS cibil_repair_timelines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cibil_repair_timelines_public_id (public_id),
  KEY idx_cibil_repair_timelines_active_order (is_active, display_order)
);

ALTER TABLE cibil_repair_plans
  ADD COLUMN billing_cycle VARCHAR(40) NULL AFTER currency;

ALTER TABLE cibil_repair_plans
  ADD COLUMN button_label VARCHAR(120) NULL AFTER billing_cycle;

INSERT INTO cibil_repair_plans (
  public_id,
  plan_name,
  amount,
  currency,
  billing_cycle,
  button_label,
  display_order,
  is_active
)
VALUES
  (
    'cibil-full-repair-monthly',
    'Full Repair',
    499.00,
    'INR',
    'monthly',
    'Start Full Repair',
    1,
    1
  )
ON DUPLICATE KEY UPDATE
  amount = VALUES(amount),
  currency = VALUES(currency),
  billing_cycle = VALUES(billing_cycle),
  button_label = VALUES(button_label),
  display_order = VALUES(display_order),
  is_active = VALUES(is_active),
  updated_at = NOW();

INSERT INTO cibil_repair_timelines (
  public_id,
  title,
  description,
  display_order,
  is_active
)
VALUES
  (
    'report-analysis',
    'Report Analysis',
    'Review accounts, enquiries, balances, and negative signals.',
    1,
    1
  ),
  (
    'error-detection',
    'Error Detection',
    'Find wrong ownership, duplicate entries, late marks, and closure gaps.',
    2,
    1
  ),
  (
    'dispute-filing',
    'Dispute Filing',
    'Prepare bureau-ready disputes with supporting documents.',
    3,
    1
  ),
  (
    'lender-negotiation',
    'Lender Negotiation',
    'Coordinate lender follow-up until account correction is confirmed.',
    4,
    1
  ),
  (
    'score-verification',
    'Score Verification',
    'Verify bureau update and score movement after resolution.',
    5,
    1
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  display_order = VALUES(display_order),
  is_active = VALUES(is_active),
  updated_at = NOW();
