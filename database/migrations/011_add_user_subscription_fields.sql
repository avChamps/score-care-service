ALTER TABLE users
  ADD COLUMN subscription_status ENUM('free', 'active', 'past_due', 'expired', 'cancelled') NOT NULL DEFAULT 'free' AFTER is_admin,
  ADD COLUMN subscription_started_at DATETIME NULL AFTER subscription_status,
  ADD COLUMN subscription_due_at DATETIME NULL AFTER subscription_started_at,
  ADD COLUMN subscription_ends_at DATETIME NULL AFTER subscription_due_at,
  ADD KEY idx_users_subscription_status_due_at (subscription_status, subscription_due_at);
