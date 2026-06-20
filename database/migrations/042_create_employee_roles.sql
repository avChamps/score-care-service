CREATE TABLE IF NOT EXISTS employee_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by_user_id BIGINT UNSIGNED NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_roles_public_id (public_id),
  UNIQUE KEY uq_employee_roles_role_name (role_name),
  KEY idx_employee_roles_status (status),
  CONSTRAINT fk_employee_roles_created_by_user_id
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_employee_roles_updated_by_user_id
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_role_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id BIGINT UNSIGNED NOT NULL,
  menu_name VARCHAR(100) NOT NULL,
  child_menu_name VARCHAR(100) NULL,
  child_menu_key VARCHAR(100) NOT NULL DEFAULT '',
  permissions JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_role_permissions_menu (role_id, menu_name, child_menu_key),
  KEY idx_employee_role_permissions_role_id (role_id),
  CONSTRAINT fk_employee_role_permissions_role_id
    FOREIGN KEY (role_id) REFERENCES employee_roles(id)
    ON DELETE CASCADE
);

ALTER TABLE employees
  ADD COLUMN role_id BIGINT UNSIGNED NULL AFTER role,
  ADD KEY idx_employees_role_id (role_id),
  ADD CONSTRAINT fk_employees_role_id
    FOREIGN KEY (role_id) REFERENCES employee_roles(id)
    ON DELETE SET NULL;
