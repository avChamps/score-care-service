CREATE TABLE IF NOT EXISTS general_settings (
  id TINYINT UNSIGNED NOT NULL,
  website VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  mobile_number VARCHAR(30) NULL,
  whatsapp_number VARCHAR(30) NULL,
  selected_language VARCHAR(80) NOT NULL DEFAULT 'English',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO general_settings (
  id,
  website,
  email,
  mobile_number,
  whatsapp_number,
  selected_language
)
VALUES (
  1,
  '',
  '',
  '',
  '',
  'English'
)
ON DUPLICATE KEY UPDATE
  id = id;
