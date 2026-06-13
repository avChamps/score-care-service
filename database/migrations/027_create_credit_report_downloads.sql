CREATE TABLE IF NOT EXISTS credit_report_downloads (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  credit_report_id BIGINT UNSIGNED NULL,
  report_type VARCHAR(50) NOT NULL,
  downloaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_credit_report_downloads_user_id (user_id),
  KEY idx_credit_report_downloads_downloaded_at (downloaded_at),
  KEY idx_credit_report_downloads_credit_report_id (credit_report_id),
  CONSTRAINT fk_credit_report_downloads_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_credit_report_downloads_credit_report_id
    FOREIGN KEY (credit_report_id) REFERENCES credit_reports(id)
    ON DELETE SET NULL
);
