ALTER TABLE subscription_plans
  ADD COLUMN title VARCHAR(160) NULL AFTER recommended_for,
  ADD COLUMN subtitle VARCHAR(160) NULL AFTER title,
  ADD COLUMN description TEXT NULL AFTER subtitle,
  ADD COLUMN image_url VARCHAR(500) NULL AFTER description,
  ADD COLUMN benefits JSON NULL AFTER image_url,
  ADD COLUMN features JSON NULL AFTER benefits,
  ADD COLUMN button_label VARCHAR(80) NULL AFTER features,
  ADD COLUMN skip_label VARCHAR(80) NULL AFTER button_label;

UPDATE subscription_plans
SET
  title = COALESCE(title, 'Unlock premium features'),
  subtitle = COALESCE(subtitle, offer_tag),
  description = COALESCE(description, recommended_for),
  benefits = COALESCE(benefits, JSON_ARRAY()),
  features = COALESCE(features, JSON_ARRAY()),
  button_label = COALESCE(button_label, 'Subscribe'),
  skip_label = COALESCE(skip_label, 'Skip for later')
WHERE public_id IS NOT NULL;
