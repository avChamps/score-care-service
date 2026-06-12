CREATE TABLE IF NOT EXISTS faqs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL,
  category VARCHAR(80) NOT NULL,
  category_label VARCHAR(120) NOT NULL,
  icon VARCHAR(120) NULL,
  question VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_faqs_public_id (public_id),
  KEY idx_faqs_active_order (is_active, category, display_order)
);
