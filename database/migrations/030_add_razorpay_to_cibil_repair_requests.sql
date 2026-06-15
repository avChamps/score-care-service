ALTER TABLE cibil_repair_requests
  ADD COLUMN razorpay_order_id VARCHAR(80) NULL AFTER payment_status,
  ADD COLUMN razorpay_payment_id VARCHAR(80) NULL AFTER razorpay_order_id,
  ADD UNIQUE KEY uq_cibil_repair_requests_razorpay_payment_id (razorpay_payment_id),
  ADD KEY idx_cibil_repair_requests_razorpay_order_id (razorpay_order_id);
