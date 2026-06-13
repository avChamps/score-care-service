CREATE TABLE IF NOT EXISTS cibil_repair_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  user_public_id VARCHAR(36) NOT NULL,
  plan_public_id VARCHAR(36) NULL,
  plan_name VARCHAR(120) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  repair_status ENUM('submitted', 'analysis', 'in_progress', 'resolved', 'closed', 'cancelled') NOT NULL DEFAULT 'submitted',
  active_disputes INT UNSIGNED NOT NULL DEFAULT 0,
  resolved_disputes INT UNSIGNED NOT NULL DEFAULT 0,
  points_gained INT NOT NULL DEFAULT 0,
  progress_items JSON NULL,
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cibil_repair_requests_public_id (public_id),
  KEY idx_cibil_repair_requests_user_id (user_id),
  KEY idx_cibil_repair_requests_repair_status (repair_status),
  CONSTRAINT fk_cibil_repair_requests_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
