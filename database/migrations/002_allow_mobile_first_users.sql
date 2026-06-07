ALTER TABLE users
  MODIFY pan_number VARCHAR(10) NULL,
  MODIFY full_name VARCHAR(150) NULL;

ALTER TABLE user_login_events
  MODIFY pan_number VARCHAR(10) NULL;
