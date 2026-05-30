ALTER TABLE relatorios_semanais
  ADD COLUMN IF NOT EXISTS atividades_semana JSONB;
