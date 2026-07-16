-- CrmCampanha: campos de segmentação (perfil, potencial, etapa, canal) +
-- vínculo com template + modo (snapshot/ao_vivo) + status
ALTER TABLE "crm_campanhas"
  ADD COLUMN "perfil_alvo"    VARCHAR(30),
  ADD COLUMN "potencial_alvo" VARCHAR(20),
  ADD COLUMN "etapa_alvo"     VARCHAR(30),
  ADD COLUMN "canal"          VARCHAR(20),
  ADD COLUMN "template_id"    UUID,
  ADD COLUMN "modo"           VARCHAR(20) NOT NULL DEFAULT 'snapshot',
  ADD COLUMN "status"         VARCHAR(20) NOT NULL DEFAULT 'rascunho';

CREATE INDEX "crm_campanhas_perfil_alvo_idx" ON "crm_campanhas" ("perfil_alvo");
