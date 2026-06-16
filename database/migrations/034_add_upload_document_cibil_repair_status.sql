ALTER TABLE cibil_repair_requests
  MODIFY repair_status ENUM('upload_document', 'submitted', 'analysis', 'in_progress', 'resolved', 'closed', 'cancelled') NOT NULL DEFAULT 'upload_document';
