ALTER TABLE cibil_repair_requests
  MODIFY repair_status ENUM('upload_document', 'submitted', 'under_review', 'analysis', 'in_progress', 'resolved', 'closed', 'cancelled') NOT NULL DEFAULT 'upload_document',
  ADD COLUMN assigned_employee_id BIGINT UNSIGNED NULL AFTER accounts,
  ADD COLUMN bureau VARCHAR(80) NULL AFTER assigned_employee_id,
  ADD KEY idx_cibil_repair_requests_assigned_employee_id (assigned_employee_id),
  ADD CONSTRAINT fk_cibil_repair_requests_assigned_employee_id
    FOREIGN KEY (assigned_employee_id) REFERENCES employees(id)
    ON DELETE SET NULL;

ALTER TABLE credit_repair_documents
  ADD COLUMN file_size BIGINT UNSIGNED NULL AFTER document_url;

CREATE TABLE IF NOT EXISTS cibil_repair_request_timelines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  actor_name VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cibil_repair_request_timelines_request_id (request_id),
  CONSTRAINT fk_cibil_repair_request_timelines_request_id
    FOREIGN KEY (request_id) REFERENCES cibil_repair_requests(id)
    ON DELETE CASCADE
);
