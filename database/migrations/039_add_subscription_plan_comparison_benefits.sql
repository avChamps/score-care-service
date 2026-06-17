ALTER TABLE subscription_plans
  ADD COLUMN comparison_benefits JSON NULL AFTER benefits;

UPDATE subscription_plans
SET comparison_benefits = JSON_ARRAY(
  JSON_OBJECT('benefit', 'Credit Score Check', 'free', true, 'scorecarePro', true),
  JSON_OBJECT('benefit', 'Score Refresh', 'free', 'Monthly', 'scorecarePro', 'Daily'),
  JSON_OBJECT('benefit', 'AI Credit Improvement Plan', 'free', false, 'scorecarePro', true),
  JSON_OBJECT('benefit', 'Detailed Credit Reports', 'free', false, 'scorecarePro', true),
  JSON_OBJECT('benefit', 'Loan & Credit Card Tracking', 'free', false, 'scorecarePro', true),
  JSON_OBJECT('benefit', 'EMI Reminders', 'free', false, 'scorecarePro', true),
  JSON_OBJECT('benefit', 'AI Credit Coach', 'free', false, 'scorecarePro', true),
  JSON_OBJECT('benefit', 'Priority Support', 'free', false, 'scorecarePro', true)
)
WHERE public_id IS NOT NULL;
