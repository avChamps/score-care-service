ALTER TABLE cibil_repair_plans
  ADD COLUMN gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER currency;
