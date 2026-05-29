-- Add anguloId to relatorio_fotos (links photo to a fixed ObraAmbiente angle)
ALTER TABLE relatorio_fotos
  ADD COLUMN "angulo_id" UUID REFERENCES obra_ambientes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "relatorio_fotos_angulo_id_idx" ON relatorio_fotos("angulo_id");

-- Add categoria to relatorio_pendencias
ALTER TABLE relatorio_pendencias
  ADD COLUMN categoria VARCHAR(30) NOT NULL DEFAULT 'cliente';
