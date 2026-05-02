-- Add probabilidade field to orcamentos
ALTER TABLE "orcamentos"
  ADD COLUMN IF NOT EXISTS "probabilidade" VARCHAR(20);
