ALTER TABLE relatorios_semanais
  ADD COLUMN IF NOT EXISTS efetivo_por_disciplina JSONB;
