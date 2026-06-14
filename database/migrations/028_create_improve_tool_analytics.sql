CREATE TABLE IF NOT EXISTS improve_tool_analytics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_improve_tool_analytics_user_id (user_id),
  KEY idx_improve_tool_analytics_viewed_at (viewed_at),
  CONSTRAINT fk_improve_tool_analytics_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);
