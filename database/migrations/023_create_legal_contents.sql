CREATE TABLE IF NOT EXISTS legal_contents (
  id TINYINT UNSIGNED NOT NULL,
  terms_and_conditions LONGTEXT NULL,
  privacy_policy LONGTEXT NULL,
  consent LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO legal_contents (
  id,
  terms_and_conditions,
  privacy_policy,
  consent
)
VALUES (
  1,
  '',
  '',
  ''
)
ON DUPLICATE KEY UPDATE
  id = id;
