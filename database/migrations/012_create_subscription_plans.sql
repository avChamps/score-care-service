CREATE TABLE IF NOT EXISTS subscription_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL,
  plan_name VARCHAR(120) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  offer_tag VARCHAR(80) NULL,
  recommended_for VARCHAR(180) NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_plans_public_id (public_id),
  UNIQUE KEY uq_subscription_plans_plan_name (plan_name),
  KEY idx_subscription_plans_active_order (is_active, display_order)
);

INSERT INTO subscription_plans (
  public_id,
  plan_name,
  amount,
  currency,
  offer_tag,
  recommended_for,
  display_order,
  is_active
)
VALUES
  (
    'scorecare-basic-monthly',
    'Basic',
    99.00,
    'INR',
    'Starter',
    'New users checking their credit basics',
    1,
    1
  ),
  (
    'scorecare-pro-monthly',
    'Pro',
    199.00,
    'INR',
    'Best value',
    'Users improving and monitoring credit health',
    2,
    1
  ),
  (
    'scorecare-premium-monthly',
    'Premium',
    499.00,
    'INR',
    'Most complete',
    'Users who want full credit guidance',
    3,
    1
  )
ON DUPLICATE KEY UPDATE
  amount = VALUES(amount),
  currency = VALUES(currency),
  offer_tag = VALUES(offer_tag),
  recommended_for = VALUES(recommended_for),
  display_order = VALUES(display_order),
  is_active = VALUES(is_active),
  updated_at = NOW();
