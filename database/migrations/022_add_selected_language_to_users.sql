ALTER TABLE users
  ADD COLUMN selected_language VARCHAR(80) NOT NULL DEFAULT 'English' AFTER date_of_birth;
