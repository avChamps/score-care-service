ALTER TABLE subscription_plans
  ADD COLUMN razorpay_plan_id VARCHAR(80) NULL AFTER plan_name,
  ADD UNIQUE KEY uq_subscription_plans_razorpay_plan_id (razorpay_plan_id);

ALTER TABLE users
  ADD COLUMN subscription_plan_id BIGINT UNSIGNED NULL AFTER subscription_status,
  ADD COLUMN razorpay_subscription_id VARCHAR(80) NULL AFTER subscription_plan_id,
  ADD UNIQUE KEY uq_users_razorpay_subscription_id (razorpay_subscription_id),
  ADD KEY idx_users_subscription_plan_id (subscription_plan_id),
  ADD CONSTRAINT fk_users_subscription_plan_id
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS subscription_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  subscription_plan_id BIGINT UNSIGNED NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  payment_status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  payment_gateway VARCHAR(40) NULL,
  razorpay_subscription_id VARCHAR(80) NULL,
  razorpay_payment_id VARCHAR(80) NULL,
  paid_at DATETIME NULL,
  updated_by_user_id BIGINT UNSIGNED NULL,
  gateway_payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_payments_razorpay_payment_id (razorpay_payment_id),
  KEY idx_subscription_payments_user_status (user_id, payment_status),
  KEY idx_subscription_payments_plan_id (subscription_plan_id),
  KEY idx_subscription_payments_subscription_id (razorpay_subscription_id),
  CONSTRAINT fk_subscription_payments_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_subscription_payments_plan_id
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_subscription_payments_updated_by_user_id
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);
