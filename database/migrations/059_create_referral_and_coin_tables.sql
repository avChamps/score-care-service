CREATE TABLE IF NOT EXISTS referral_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_referral_codes_public_id (public_id),
  UNIQUE KEY uq_referral_codes_user_id (user_id),
  UNIQUE KEY uq_referral_codes_code (code),
  CONSTRAINT fk_referral_codes_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referrals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  referrer_user_id BIGINT UNSIGNED NOT NULL,
  referee_user_id BIGINT UNSIGNED NULL,
  referral_code VARCHAR(20) NOT NULL,
  status ENUM('invited', 'signed_up', 'kyc_completed', 'rewarded', 'rejected') NOT NULL DEFAULT 'invited',
  device_id VARCHAR(150) NULL,
  ip_hash VARCHAR(150) NULL,
  pan_hash VARCHAR(150) NULL,
  aadhaar_hash VARCHAR(150) NULL,
  fraud_status ENUM('clear', 'flagged', 'approved', 'rejected') NOT NULL DEFAULT 'clear',
  fraud_reason VARCHAR(255) NULL,
  rewarded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_referrals_public_id (public_id),
  UNIQUE KEY uq_referrals_referee_user_id (referee_user_id),
  KEY idx_referrals_referrer_user_id (referrer_user_id),
  KEY idx_referrals_referral_code (referral_code),
  KEY idx_referrals_status (status),
  KEY idx_referrals_fraud_status (fraud_status),
  KEY idx_referrals_device_id (device_id),
  CONSTRAINT fk_referrals_referrer_user_id
    FOREIGN KEY (referrer_user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_referrals_referee_user_id
    FOREIGN KEY (referee_user_id) REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coin_balances (
  user_id BIGINT UNSIGNED NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  lifetime_earned INT NOT NULL DEFAULT 0,
  lifetime_redeemed INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_coin_balances_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('earn', 'redeem', 'expire', 'admin_adjustment') NOT NULL,
  source ENUM('referral_signup', 'referral_kyc', 'referral_subscription', 'referral_milestone', 'redemption', 'manual') NOT NULL,
  amount INT NOT NULL,
  reference_type VARCHAR(80) NULL,
  reference_id BIGINT UNSIGNED NULL,
  balance_after INT NOT NULL,
  description VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coin_transactions_public_id (public_id),
  KEY idx_coin_transactions_user_id (user_id),
  KEY idx_coin_transactions_type (type),
  KEY idx_coin_transactions_source (source),
  KEY idx_coin_transactions_created_at (created_at),
  CONSTRAINT fk_coin_transactions_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rewards_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  type ENUM('subscription_discount', 'credit_repair_discount', 'cashback', 'partner_offer') NOT NULL,
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  value_type ENUM('flat', 'percentage') NOT NULL DEFAULT 'flat',
  terms TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rewards_catalog_public_id (public_id),
  KEY idx_rewards_catalog_is_active (is_active)
);

CREATE TABLE IF NOT EXISTS redemption_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reward_id BIGINT UNSIGNED NOT NULL,
  coin_cost INT NOT NULL,
  max_redemptions_per_user INT NULL,
  valid_from DATETIME NULL,
  valid_to DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_redemption_rules_reward_id (reward_id),
  CONSTRAINT fk_redemption_rules_reward_id
    FOREIGN KEY (reward_id) REFERENCES rewards_catalog(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  reward_id BIGINT UNSIGNED NOT NULL,
  coins_spent INT NOT NULL,
  status ENUM('pending', 'applied', 'cancelled', 'failed') NOT NULL DEFAULT 'applied',
  apply_to VARCHAR(80) NULL,
  target_public_id VARCHAR(150) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reward_redemptions_public_id (public_id),
  KEY idx_reward_redemptions_user_id (user_id),
  KEY idx_reward_redemptions_reward_id (reward_id),
  CONSTRAINT fk_reward_redemptions_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_reward_redemptions_reward_id
    FOREIGN KEY (reward_id) REFERENCES rewards_catalog(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS coin_rule_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rule_key VARCHAR(80) NOT NULL,
  coin_amount INT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coin_rule_settings_rule_key (rule_key)
);

INSERT IGNORE INTO coin_rule_settings (rule_key, coin_amount, description)
VALUES
  ('referee_signup_bonus', 50, 'Welcome coins for referee after applying a referral code'),
  ('referrer_kyc_bonus', 500, 'Main referrer reward after referee completes KYC'),
  ('referrer_subscription_bonus', 250, 'Bonus after referred user subscribes to ScoreCare Pro'),
  ('referrer_5_success_bonus', 1000, 'Milestone bonus after 5 rewarded referrals'),
  ('referrer_10_success_bonus', 2500, 'Milestone bonus after 10 rewarded referrals');

INSERT IGNORE INTO rewards_catalog (
  public_id,
  title,
  description,
  type,
  value,
  value_type,
  terms,
  display_order
)
VALUES
  (UUID(), 'ScoreCare Pro Discount', 'Redeem coins for a flat discount on ScoreCare Pro subscription.', 'subscription_discount', 100.00, 'flat', 'Applicable once per checkout. Cannot be exchanged for cash.', 1),
  (UUID(), 'Credit Repair Discount', 'Redeem coins for a discount on credit repair service fees.', 'credit_repair_discount', 250.00, 'flat', 'Applicable on eligible credit repair service orders.', 2);

INSERT IGNORE INTO redemption_rules (reward_id, coin_cost, max_redemptions_per_user, is_active)
SELECT id, 1000, 3, 1
FROM rewards_catalog
WHERE title = 'ScoreCare Pro Discount';

INSERT IGNORE INTO redemption_rules (reward_id, coin_cost, max_redemptions_per_user, is_active)
SELECT id, 2000, 2, 1
FROM rewards_catalog
WHERE title = 'Credit Repair Discount';
