-- CreateTable
CREATE TABLE "ambientes" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_obras" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "data" DATE NOT NULL,
    "clima" VARCHAR(20),
    "condicao_trabalho" VARCHAR(20),
    "observacoes_internas" TEXT,
    "observacoes_cliente" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    "fechado_em" TIMESTAMP(3),
    "fechado_por_id" UUID,
    "criado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_efetivos" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "user_id" UUID,
    "nome_externo" TEXT,
    "funcao" VARCHAR(100),
    "origem" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "presente" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_efetivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_atividades" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "obra_etapa_id" UUID,
    "descricao" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "origem" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_fotos" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "ambiente_id" UUID,
    "file_url" TEXT NOT NULL,
    "legenda" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_ocorrencias" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "descricao" TEXT NOT NULL,
    "visivel_cliente" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_ocorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_visitas" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "nome" VARCHAR(255),
    "observacao" TEXT,
    "visivel_cliente" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_materiais" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "recebimento_material_id" UUID,
    "descricao" TEXT NOT NULL,
    "origem" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diario_equipamentos" (
    "id" UUID NOT NULL,
    "diario_id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diario_equipamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ambientes_obra_id_nome_key" ON "ambientes"("obra_id", "nome");

-- CreateIndex
CREATE INDEX "ambientes_obra_id_idx" ON "ambientes"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "diario_obras_obra_id_data_key" ON "diario_obras"("obra_id", "data");

-- CreateIndex
CREATE INDEX "diario_obras_obra_id_data_idx" ON "diario_obras"("obra_id", "data");

-- CreateIndex
CREATE INDEX "diario_obras_status_idx" ON "diario_obras"("status");

-- CreateIndex
CREATE INDEX "diario_efetivos_diario_id_idx" ON "diario_efetivos"("diario_id");

-- CreateIndex
CREATE INDEX "diario_atividades_diario_id_idx" ON "diario_atividades"("diario_id");

-- CreateIndex
CREATE INDEX "diario_fotos_diario_id_idx" ON "diario_fotos"("diario_id");

-- CreateIndex
CREATE INDEX "diario_fotos_ambiente_id_idx" ON "diario_fotos"("ambiente_id");

-- CreateIndex
CREATE INDEX "diario_ocorrencias_diario_id_idx" ON "diario_ocorrencias"("diario_id");

-- CreateIndex
CREATE INDEX "diario_visitas_diario_id_idx" ON "diario_visitas"("diario_id");

-- CreateIndex
CREATE INDEX "diario_materiais_diario_id_idx" ON "diario_materiais"("diario_id");

-- CreateIndex
CREATE INDEX "diario_equipamentos_diario_id_idx" ON "diario_equipamentos"("diario_id");

-- AddForeignKey
ALTER TABLE "ambientes" ADD CONSTRAINT "ambientes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_obras" ADD CONSTRAINT "diario_obras_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_obras" ADD CONSTRAINT "diario_obras_fechado_por_id_fkey" FOREIGN KEY ("fechado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_obras" ADD CONSTRAINT "diario_obras_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_efetivos" ADD CONSTRAINT "diario_efetivos_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_efetivos" ADD CONSTRAINT "diario_efetivos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_atividades" ADD CONSTRAINT "diario_atividades_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_fotos" ADD CONSTRAINT "diario_fotos_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_fotos" ADD CONSTRAINT "diario_fotos_ambiente_id_fkey" FOREIGN KEY ("ambiente_id") REFERENCES "ambientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_fotos" ADD CONSTRAINT "diario_fotos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_ocorrencias" ADD CONSTRAINT "diario_ocorrencias_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_visitas" ADD CONSTRAINT "diario_visitas_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_materiais" ADD CONSTRAINT "diario_materiais_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diario_equipamentos" ADD CONSTRAINT "diario_equipamentos_diario_id_fkey" FOREIGN KEY ("diario_id") REFERENCES "diario_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
