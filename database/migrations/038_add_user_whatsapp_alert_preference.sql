ALTER TABLE users
  ADD COLUMN whatsapp_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER selected_language;
