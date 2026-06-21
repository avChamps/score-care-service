CREATE TABLE IF NOT EXISTS website_settings (
  id TINYINT UNSIGNED NOT NULL,
  privacy_policy LONGTEXT NULL,
  terms_of_service LONGTEXT NULL,
  disclaimer LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO website_settings (
  id,
  privacy_policy,
  terms_of_service,
  disclaimer
)
VALUES (
  1,
  '',
  '',
  ''
)
ON DUPLICATE KEY UPDATE
  id = id;
