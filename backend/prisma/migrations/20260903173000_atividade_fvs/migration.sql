-- FVS por atividade (03/09/26): ficha gerada dos critérios de qualidade da IT
-- quando uma vistoria marca a atividade como em execução.
CREATE TABLE "atividade_fvs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "it_code" VARCHAR(20),
    "titulo" VARCHAR(200) NOT NULL,
    "trecho" VARCHAR(150),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "prazo" DATE,
    "contratacao_id" UUID,
    "criada_por_vistoria_id" UUID,
    "preenchido_por" UUID,
    "preenchido_em" TIMESTAMP(3),
    "ultimo_alerta_em" TIMESTAMP(3),
    "alerta_escalado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividade_fvs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "atividade_fvs_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fvs_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "texto" TEXT NOT NULL,
    "resposta" VARCHAR(15),
    "observacao" TEXT,
    "foto_url" TEXT,

    CONSTRAINT "atividade_fvs_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "atividade_fvs_obra_id_status_idx" ON "atividade_fvs"("obra_id", "status");
CREATE INDEX "atividade_fvs_itens_fvs_id_idx" ON "atividade_fvs_itens"("fvs_id");

ALTER TABLE "atividade_fvs" ADD CONSTRAINT "atividade_fvs_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "atividade_fvs" ADD CONSTRAINT "atividade_fvs_preenchido_por_fkey"
    FOREIGN KEY ("preenchido_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "atividade_fvs_itens" ADD CONSTRAINT "atividade_fvs_itens_fvs_id_fkey"
    FOREIGN KEY ("fvs_id") REFERENCES "atividade_fvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
