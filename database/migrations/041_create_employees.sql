CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  employee_code VARCHAR(50) NULL,
  full_name VARCHAR(150) NOT NULL,
  mobile_number VARCHAR(15) NOT NULL,
  email VARCHAR(255) NULL,
  role VARCHAR(100) NOT NULL,
  department VARCHAR(100) NULL,
  designation VARCHAR(120) NULL,
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  joined_at DATE NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_public_id (public_id),
  UNIQUE KEY uq_employees_employee_code (employee_code),
  UNIQUE KEY uq_employees_mobile_number (mobile_number),
  UNIQUE KEY uq_employees_email (email),
  KEY idx_employees_status (status),
  KEY idx_employees_deleted_at (deleted_at),
  CONSTRAINT fk_employees_created_by_user_id
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_employees_updated_by_user_id
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);
