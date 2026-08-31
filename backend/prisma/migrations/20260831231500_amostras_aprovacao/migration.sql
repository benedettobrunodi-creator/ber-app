-- Durante a Obra · Aprovação de Amostras (31/08/26)
-- Registro de amostras enviadas pra aprovação, com foto(s), status e
-- disparo de e-mail pra todos os stakeholders da obra.

CREATE TABLE "amostras_aprovacao" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "obra_id" UUID NOT NULL,
  "item" VARCHAR(200) NOT NULL,
  "marca" VARCHAR(120),
  "especificacao" TEXT,
  "ambiente" VARCHAR(120),
  "status" VARCHAR(15) NOT NULL DEFAULT 'aprovado',
  "data_aprovacao" DATE,
  "responsavel_stakeholder_id" UUID,
  "observacoes" TEXT,
  "fotos" TEXT[] NOT NULL DEFAULT '{}',
  "email_enviado_em" TIMESTAMP(3),
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "amostras_aprovacao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "amostras_aprovacao_obra_id_idx" ON "amostras_aprovacao"("obra_id");

ALTER TABLE "amostras_aprovacao" ADD CONSTRAINT "amostras_aprovacao_obra_id_fkey"
  FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "amostras_aprovacao" ADD CONSTRAINT "amostras_aprovacao_responsavel_stakeholder_id_fkey"
  FOREIGN KEY ("responsavel_stakeholder_id") REFERENCES "obra_stakeholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "amostras_aprovacao" ADD CONSTRAINT "amostras_aprovacao_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
