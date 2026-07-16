-- CrmOportunidade: ordem manual dentro da coluna do kanban
ALTER TABLE "crm_oportunidades"
  ADD COLUMN "ordem" INTEGER;

-- Semeia ordens sequenciais por etapa baseadas em updated_at desc, com gap 1000
-- pra permitir inserções entre cards sem precisar renumerar tudo.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY etapa ORDER BY updated_at DESC) AS rn
  FROM "crm_oportunidades"
)
UPDATE "crm_oportunidades" o
SET "ordem" = r.rn * 1000
FROM ranked r
WHERE o.id = r.id;

CREATE INDEX "crm_oportunidades_etapa_ordem_idx" ON "crm_oportunidades" ("etapa", "ordem");
