ALTER TABLE users
  ADD COLUMN public_id CHAR(36) NULL AFTER id;

UPDATE users
SET public_id = UUID()
WHERE public_id IS NULL;

ALTER TABLE users
  MODIFY public_id CHAR(36) NOT NULL;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_public_id (public_id);

ALTER TABLE credit_reports
  ADD COLUMN user_public_id CHAR(36) NULL AFTER user_id;

UPDATE credit_reports cr
INNER JOIN users u ON u.id = cr.user_id
SET cr.user_public_id = u.public_id
WHERE cr.user_public_id IS NULL;

ALTER TABLE credit_reports
  MODIFY user_public_id CHAR(36) NOT NULL;

ALTER TABLE credit_reports
  ADD KEY idx_credit_reports_user_public_id (user_public_id);
