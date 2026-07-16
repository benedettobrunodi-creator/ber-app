-- CrmContato: campos de segmentação + funil de nutrição
ALTER TABLE "crm_contatos"
  ADD COLUMN "perfil"          VARCHAR(30),
  ADD COLUMN "potencial"       VARCHAR(20),
  ADD COLUMN "etapa_nutricao"  VARCHAR(30),
  ADD COLUMN "ordem_nutricao"  INTEGER;

-- Migração: contatos que já estão em nutrição entram na etapa "Descoberta"
-- com ordem baseada no último contato (mais recente primeiro).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY ultimo_contato DESC NULLS LAST, created_at DESC) AS rn
  FROM "crm_contatos"
  WHERE "nutricao" = true
)
UPDATE "crm_contatos" c
SET "etapa_nutricao" = 'descoberta',
    "ordem_nutricao" = r.rn * 1000
FROM ranked r
WHERE c.id = r.id;

-- Reiniciar campanhas antigas (Bruno pediu tabula rasa)
DELETE FROM "crm_campanha_contatos";
DELETE FROM "crm_campanhas";

CREATE INDEX "crm_contatos_etapa_nutricao_ordem_nutricao_idx"
  ON "crm_contatos" ("etapa_nutricao", "ordem_nutricao");

-- Templates de mensagem por etapa/canal (a serem preenchidos manualmente
-- pelo time comercial + marketing).
CREATE TABLE "crm_nutricao_templates" (
  "id"           UUID         PRIMARY KEY,
  "etapa"        VARCHAR(30)  NOT NULL,
  "canal"        VARCHAR(20)  NOT NULL,
  "titulo"       VARCHAR(200) NOT NULL,
  "corpo"        TEXT         NOT NULL,
  "perfil_alvo"  VARCHAR(30),
  "ordem"        INTEGER      NOT NULL DEFAULT 0,
  "ativo"        BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL
);

CREATE INDEX "crm_nutricao_templates_etapa_canal_idx"
  ON "crm_nutricao_templates" ("etapa", "canal");
