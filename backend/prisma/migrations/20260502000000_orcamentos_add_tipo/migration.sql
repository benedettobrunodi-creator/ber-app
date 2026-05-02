-- Add tipo field to orcamentos
ALTER TABLE "orcamentos"
  ADD COLUMN IF NOT EXISTS "tipo" VARCHAR(20) NOT NULL DEFAULT 'NOVO';
