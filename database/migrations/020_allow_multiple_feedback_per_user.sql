ALTER TABLE feedback
  DROP INDEX uq_feedback_user_id;

ALTER TABLE feedback
  ADD KEY idx_feedback_user_id (user_id);
