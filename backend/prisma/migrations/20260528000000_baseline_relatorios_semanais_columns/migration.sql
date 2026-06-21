-- Baseline para colunas adicionadas via `prisma db push` na tabela
-- relatorios_semanais sem migration formal. Já existem no DB; o IF NOT EXISTS
-- mantém esta migration idempotente caso seja replicada.

ALTER TABLE "relatorios_semanais"
  ADD COLUMN IF NOT EXISTS "data_inicio_obra"       DATE,
  ADD COLUMN IF NOT EXISTS "data_prevista_termino"  DATE,
  ADD COLUMN IF NOT EXISTS "data_real_termino"      DATE,
  ADD COLUMN IF NOT EXISTS "entregas_previstas"     JSONB,
  ADD COLUMN IF NOT EXISTS "plano_acao"             JSONB,
  ADD COLUMN IF NOT EXISTS "pontos_atencao"         JSONB,
  ADD COLUMN IF NOT EXISTS "secoes_pdf"             JSONB;
