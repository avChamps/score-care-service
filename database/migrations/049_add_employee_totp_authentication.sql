ALTER TABLE employees
  ADD COLUMN totp_secret TEXT NULL AFTER status,
  ADD COLUMN totp_enabled_at DATETIME NULL AFTER totp_secret,
  ADD COLUMN totp_last_used_step BIGINT UNSIGNED NULL AFTER totp_enabled_at;
