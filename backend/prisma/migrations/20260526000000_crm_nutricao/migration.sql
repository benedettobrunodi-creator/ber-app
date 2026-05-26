-- Nurturing fields on crm_contatos
ALTER TABLE "crm_contatos"
  ADD COLUMN "nutricao" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "proximo_contato" TIMESTAMPTZ,
  ADD COLUMN "ultimo_contato" TIMESTAMPTZ,
  ADD COLUMN "notas_relacionamento" TEXT,
  ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Campaigns
CREATE TABLE "crm_campanhas" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome" VARCHAR(255) NOT NULL,
  "descricao" TEXT,
  "responsavel_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "crm_campanha_contatos" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "campanha_id" UUID NOT NULL REFERENCES "crm_campanhas"("id") ON DELETE CASCADE,
  "contato_id" UUID NOT NULL REFERENCES "crm_contatos"("id") ON DELETE CASCADE,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pendente',
  "notas" TEXT,
  "contatado_em" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("campanha_id", "contato_id")
);
