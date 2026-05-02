-- Add ordem field to orcamentos
ALTER TABLE "orcamentos"
  ADD COLUMN IF NOT EXISTS "ordem" INTEGER NOT NULL DEFAULT 0;
