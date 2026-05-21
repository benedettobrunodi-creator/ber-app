-- Add data_ganho to crm_oportunidades
ALTER TABLE "crm_oportunidades" ADD COLUMN "data_ganho" DATE;

-- Backfill from historico (most recent time etapa was set to 'ganho')
UPDATE "crm_oportunidades" o
SET "data_ganho" = (
  SELECT DATE(h."alterado_em")
  FROM "crm_oportunidade_historico" h
  WHERE h."oportunidade_id" = o.id
    AND h."campo" = 'etapa'
    AND h."valor_novo" = 'ganho'
  ORDER BY h."alterado_em" DESC
  LIMIT 1
)
WHERE o."etapa" = 'ganho';
