-- Relatório de Recebimento do Imóvel (02/09/26)
CREATE TABLE "recebimento_relatorios" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    "data_vistoria" DATE,
    "responsavel_id" UUID,
    "objetivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recebimento_relatorios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recebimento_relatorios_obra_id_key" ON "recebimento_relatorios"("obra_id");
ALTER TABLE "recebimento_relatorios" ADD CONSTRAINT "recebimento_relatorios_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recebimento_relatorios" ADD CONSTRAINT "recebimento_relatorios_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "recebimento_ambientes" (
    "id" UUID NOT NULL,
    "relatorio_id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recebimento_ambientes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recebimento_ambientes_relatorio_id_idx" ON "recebimento_ambientes"("relatorio_id");
ALTER TABLE "recebimento_ambientes" ADD CONSTRAINT "recebimento_ambientes_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "recebimento_relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "recebimento_fotos" (
    "id" UUID NOT NULL,
    "relatorio_id" UUID NOT NULL,
    "ambiente_id" UUID,
    "url" TEXT NOT NULL,
    "legenda" TEXT,
    "patologia" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recebimento_fotos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "recebimento_fotos_relatorio_id_idx" ON "recebimento_fotos"("relatorio_id");
CREATE INDEX "recebimento_fotos_ambiente_id_idx" ON "recebimento_fotos"("ambiente_id");
ALTER TABLE "recebimento_fotos" ADD CONSTRAINT "recebimento_fotos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "recebimento_relatorios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recebimento_fotos" ADD CONSTRAINT "recebimento_fotos_ambiente_id_fkey" FOREIGN KEY ("ambiente_id") REFERENCES "recebimento_ambientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
