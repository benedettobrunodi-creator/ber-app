-- CrmOportunidade: marca projeto estratégico + campo pra descrever a jogada
ALTER TABLE "crm_oportunidades"
  ADD COLUMN "estrela"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notas_estrategia" TEXT;

CREATE INDEX "crm_oportunidades_estrela_idx" ON "crm_oportunidades" ("estrela") WHERE "estrela" = true;
