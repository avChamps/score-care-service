ALTER TABLE general_settings
  ADD COLUMN selected_language VARCHAR(80) NOT NULL DEFAULT 'English' AFTER whatsapp_number;
