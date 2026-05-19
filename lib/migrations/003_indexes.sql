-- Performance indexes for high-traffic query paths
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(case_id, processed);
CREATE INDEX IF NOT EXISTS idx_purchases_case_id ON purchases(case_id, user_id);
