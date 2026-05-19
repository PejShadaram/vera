-- 002_add_petitioner_name.sql
-- Stores the petitioner's full legal name separately from the case name.
-- Used in Forms, drafts, and anywhere a full name is needed on court documents.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS petitioner_name TEXT;
