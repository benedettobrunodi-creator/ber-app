-- AddColumn Obra: orcamento_id
ALTER TABLE "obras" ADD COLUMN "orcamento_id" UUID;
ALTER TABLE "obras" ADD CONSTRAINT "obras_orcamento_id_key" UNIQUE ("orcamento_id");
ALTER TABLE "obras" ADD CONSTRAINT "obras_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddColumn CrmOportunidade -> Orcamento (back-reference via unique FK on oportunidade side)
-- (handled by crm_oportunidades.orcamento_id below)

-- CreateTable crm_empresas
CREATE TABLE "crm_empresas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "razao_social" VARCHAR(255) NOT NULL,
    "cnpj" VARCHAR(18),
    "segmento" VARCHAR(50),
    "cidade" VARCHAR(100),
    "site" VARCHAR(255),
    "nutricao" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_contato" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_empresas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_empresas_cnpj_key" ON "crm_empresas"("cnpj");
CREATE INDEX "crm_empresas_nutricao_idx" ON "crm_empresas"("nutricao");

-- CreateTable crm_contatos
CREATE TABLE "crm_contatos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "empresa_id" UUID,
    "nome" VARCHAR(255) NOT NULL,
    "cargo" VARCHAR(100),
    "email" VARCHAR(255),
    "telefone" VARCHAR(20),
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_contatos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_contatos_empresa_id_idx" ON "crm_contatos"("empresa_id");
ALTER TABLE "crm_contatos" ADD CONSTRAINT "crm_contatos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "crm_empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable crm_oportunidades
CREATE TABLE "crm_oportunidades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" VARCHAR(500) NOT NULL,
    "empresa_id" UUID,
    "contato_id" UUID,
    "responsavel_id" UUID,
    "created_by_id" UUID NOT NULL,
    "valor" DECIMAL(14,2),
    "etapa" VARCHAR(50) NOT NULL DEFAULT 'lead',
    "origem" VARCHAR(50),
    "probabilidade" VARCHAR(20),
    "data_fechamento_previsto" DATE,
    "data_entrada_pipeline" DATE,
    "motivo_perda" TEXT,
    "observacoes" TEXT,
    "orcamento_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_oportunidades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_oportunidades_orcamento_id_key" ON "crm_oportunidades"("orcamento_id");
CREATE INDEX "crm_oportunidades_etapa_idx" ON "crm_oportunidades"("etapa");
CREATE INDEX "crm_oportunidades_empresa_id_idx" ON "crm_oportunidades"("empresa_id");
CREATE INDEX "crm_oportunidades_responsavel_id_idx" ON "crm_oportunidades"("responsavel_id");

ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "crm_empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "crm_contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_oportunidades" ADD CONSTRAINT "crm_oportunidades_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable crm_oportunidade_historico
CREATE TABLE "crm_oportunidade_historico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oportunidade_id" UUID NOT NULL,
    "campo" VARCHAR(100) NOT NULL,
    "valor_antigo" TEXT,
    "valor_novo" TEXT,
    "alterado_por" VARCHAR(255) NOT NULL,
    "alterado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_oportunidade_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_oportunidade_historico_oportunidade_id_idx" ON "crm_oportunidade_historico"("oportunidade_id");
ALTER TABLE "crm_oportunidade_historico" ADD CONSTRAINT "crm_oportunidade_historico_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "crm_oportunidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable crm_atividades
CREATE TABLE "crm_atividades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "oportunidade_id" UUID,
    "empresa_id" UUID,
    "usuario_id" UUID NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "duracao" INTEGER,
    "notas" TEXT,
    "google_event_id" VARCHAR(255),
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_atividades_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_atividades_oportunidade_id_idx" ON "crm_atividades"("oportunidade_id");
CREATE INDEX "crm_atividades_usuario_id_idx" ON "crm_atividades"("usuario_id");
CREATE INDEX "crm_atividades_data_hora_idx" ON "crm_atividades"("data_hora");

ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_oportunidade_id_fkey" FOREIGN KEY ("oportunidade_id") REFERENCES "crm_oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable crm_metas_vendas
CREATE TABLE "crm_metas_vendas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor_meta" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_metas_vendas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_metas_vendas_ano_mes_key" ON "crm_metas_vendas"("ano", "mes");
