-- CreateTable
CREATE TABLE "relatorios_semanais" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fim" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'no_prazo',
    "avanco_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avanco_delta" DECIMAL(5,2),
    "dias_trabalhados" INTEGER,
    "dias_uteis" INTEGER,
    "dias_improdutivos" INTEGER,
    "motivo_improdutivo" TEXT,
    "efetivo_medio" DECIMAL(6,1),
    "destaques" TEXT,
    "proximos_sete" TEXT,
    "responsavel_id" UUID,
    "responsavel_nome" VARCHAR(255),
    "data_contrato" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_semanais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio_pendencias" (
    "id" UUID NOT NULL,
    "relatorio_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" VARCHAR(255),
    "prazo" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'aberta',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorio_pendencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio_curva_s" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "semana" DATE NOT NULL,
    "planejado_pct" DECIMAL(5,2),
    "realizado_pct" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorio_curva_s_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio_fotos" (
    "id" UUID NOT NULL,
    "relatorio_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "legenda" VARCHAR(500),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorio_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio_marcos" (
    "id" UUID NOT NULL,
    "relatorio_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorio_marcos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_semanais_obra_id_numero_key" ON "relatorios_semanais"("obra_id", "numero");
CREATE INDEX "relatorios_semanais_obra_id_periodo_inicio_idx" ON "relatorios_semanais"("obra_id", "periodo_inicio");
CREATE INDEX "relatorio_pendencias_relatorio_id_idx" ON "relatorio_pendencias"("relatorio_id");
CREATE UNIQUE INDEX "relatorio_curva_s_obra_id_semana_key" ON "relatorio_curva_s"("obra_id", "semana");
CREATE INDEX "relatorio_curva_s_obra_id_idx" ON "relatorio_curva_s"("obra_id");
CREATE INDEX "relatorio_fotos_relatorio_id_idx" ON "relatorio_fotos"("relatorio_id");
CREATE INDEX "relatorio_marcos_relatorio_id_idx" ON "relatorio_marcos"("relatorio_id");

-- AddForeignKey
ALTER TABLE "relatorios_semanais" ADD CONSTRAINT "relatorios_semanais_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relatorios_semanais" ADD CONSTRAINT "relatorios_semanais_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "relatorio_pendencias" ADD CONSTRAINT "relatorio_pendencias_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios_semanais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relatorio_curva_s" ADD CONSTRAINT "relatorio_curva_s_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relatorio_fotos" ADD CONSTRAINT "relatorio_fotos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios_semanais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relatorio_marcos" ADD CONSTRAINT "relatorio_marcos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios_semanais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
