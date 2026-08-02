ALTER TABLE reward_redemptions
  ADD COLUMN razorpay_order_id VARCHAR(80) NULL AFTER target_public_id,
  ADD COLUMN consumed_at DATETIME NULL AFTER razorpay_order_id,
  ADD KEY idx_reward_redemptions_razorpay_order_id (razorpay_order_id);

ALTER TABLE subscription_payments
  ADD COLUMN gross_amount DECIMAL(10,2) NULL AFTER amount,
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER gross_amount,
  ADD COLUMN reward_redemption_id BIGINT UNSIGNED NULL AFTER discount_amount,
  ADD KEY idx_subscription_payments_reward_redemption_id (reward_redemption_id),
  ADD CONSTRAINT fk_subscription_payments_reward_redemption_id
    FOREIGN KEY (reward_redemption_id) REFERENCES reward_redemptions(id)
    ON DELETE SET NULL;
