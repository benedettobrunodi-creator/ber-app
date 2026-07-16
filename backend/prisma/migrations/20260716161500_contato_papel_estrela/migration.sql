-- CrmContato: papel na decisão (Decisor/Influenciador/Neutro) + estrela pra VIP
ALTER TABLE "crm_contatos"
  ADD COLUMN "papel"   VARCHAR(20),
  ADD COLUMN "estrela" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "crm_contatos_estrela_idx" ON "crm_contatos" ("estrela") WHERE "estrela" = true;
