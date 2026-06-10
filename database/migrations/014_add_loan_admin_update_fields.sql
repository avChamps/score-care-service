ALTER TABLE loan_applications
  ADD COLUMN remarks TEXT NULL AFTER status,
  ADD COLUMN updated_by_user_id BIGINT UNSIGNED NULL AFTER remarks,
  ADD KEY idx_loan_applications_updated_by_user_id (updated_by_user_id),
  ADD CONSTRAINT fk_loan_applications_updated_by_user_id
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL;
