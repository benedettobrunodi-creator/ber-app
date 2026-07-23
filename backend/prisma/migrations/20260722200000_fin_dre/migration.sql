-- Financeiro: DRE editável, multi-ciclo

CREATE TABLE "public"."fin_ciclos" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ano" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_ciclos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fin_ciclos_ano_idx" ON "public"."fin_ciclos"("ano");

CREATE TABLE "public"."fin_linhas" (
    "id" UUID NOT NULL,
    "ciclo_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "rotulo" VARCHAR(200) NOT NULL,
    "kpi_pct" DECIMAL(6,4),
    "orcamento_anual" DECIMAL(14,2),
    "is_total" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_header" BOOLEAN NOT NULL DEFAULT FALSE,
    "grupo_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_linhas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fin_linhas_ciclo_id_idx" ON "public"."fin_linhas"("ciclo_id");
CREATE INDEX "fin_linhas_grupo_id_idx" ON "public"."fin_linhas"("grupo_id");

CREATE TABLE "public"."fin_valores" (
    "id" UUID NOT NULL,
    "linha_id" UUID NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL(16,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fin_valores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_valores_linha_id_mes_key" ON "public"."fin_valores"("linha_id", "mes");
CREATE INDEX "fin_valores_linha_id_idx" ON "public"."fin_valores"("linha_id");

ALTER TABLE "public"."fin_linhas" ADD CONSTRAINT "fin_linhas_ciclo_id_fkey"
    FOREIGN KEY ("ciclo_id") REFERENCES "public"."fin_ciclos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."fin_linhas" ADD CONSTRAINT "fin_linhas_grupo_id_fkey"
    FOREIGN KEY ("grupo_id") REFERENCES "public"."fin_linhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."fin_valores" ADD CONSTRAINT "fin_valores_linha_id_fkey"
    FOREIGN KEY ("linha_id") REFERENCES "public"."fin_linhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
