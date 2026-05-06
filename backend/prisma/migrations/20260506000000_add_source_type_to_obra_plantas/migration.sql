-- Add missing columns to obra_plantas if they don't exist
ALTER TABLE "obra_plantas"
  ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(20) NOT NULL DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(120);
