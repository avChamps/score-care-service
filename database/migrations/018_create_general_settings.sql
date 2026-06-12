CREATE TABLE IF NOT EXISTS general_settings (
  id TINYINT UNSIGNED NOT NULL,
  website VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  mobile_number VARCHAR(30) NULL,
  whatsapp_number VARCHAR(30) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO general_settings (
  id,
  website,
  email,
  mobile_number,
  whatsapp_number
)
VALUES (
  1,
  '',
  '',
  '',
  ''
)
ON DUPLICATE KEY UPDATE
  id = id;
