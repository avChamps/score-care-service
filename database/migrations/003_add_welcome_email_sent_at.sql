ALTER TABLE users
  ADD COLUMN welcome_email_sent_at DATETIME NULL AFTER last_login_at;

UPDATE users
SET welcome_email_sent_at = COALESCE(updated_at, NOW())
WHERE email IS NOT NULL
  AND welcome_email_sent_at IS NULL;
