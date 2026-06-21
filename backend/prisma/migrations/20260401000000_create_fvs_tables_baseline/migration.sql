-- Baseline para tabelas criadas originalmente via `prisma db push` sem migration
-- formal. Cobre as 4 tabelas de FVS, medicao_itens, punch_lists e
-- punch_list_items. Estrutura espelha o estado anterior aos ALTERs subsequentes.

-- CreateTable
CREATE TABLE "fvs_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "disciplina" VARCHAR(50),
    "bloco" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "fvs_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fvs_template_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID NOT NULL,
    "momento" VARCHAR(20) NOT NULL,
    "secao" VARCHAR(100),
    "descricao" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "fvs_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_fvs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "etapa_id" UUID,
    "template_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pendente',
    "filled_by" UUID,
    "gestor_approved_by" UUID,
    "gestor_approved_at" TIMESTAMP(3),
    "coord_approved_by" UUID,
    "coord_approved_at" TIMESTAMP(3),
    "rejected_by" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "obra_fvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_fvs_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fvs_id" UUID NOT NULL,
    "template_item_id" UUID,
    "momento" VARCHAR(20) NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "observacao" TEXT,
    "foto_url" TEXT,
    "filled_at" TIMESTAMP(3),
    "filled_by" UUID,
    "na" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "obra_fvs_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fvs_template_items" ADD CONSTRAINT "fvs_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "fvs_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "obra_etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "fvs_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_filled_by_fkey" FOREIGN KEY ("filled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_gestor_approved_by_fkey" FOREIGN KEY ("gestor_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_coord_approved_by_fkey" FOREIGN KEY ("coord_approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obra_fvs" ADD CONSTRAINT "obra_fvs_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_fvs_items" ADD CONSTRAINT "obra_fvs_items_fvs_id_fkey" FOREIGN KEY ("fvs_id") REFERENCES "obra_fvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obra_fvs_items" ADD CONSTRAINT "obra_fvs_items_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "fvs_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obra_fvs_items" ADD CONSTRAINT "obra_fvs_items_filled_by_fkey" FOREIGN KEY ("filled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable medicao_itens (sem unidade/quantidade — vêm em 20260408)
CREATE TABLE "medicao_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_orcado" DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "tipo" VARCHAR(10) NOT NULL DEFAULT 'subitem',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicao_itens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "medicao_itens" ADD CONSTRAINT "medicao_itens_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable punch_lists
CREATE TABLE "punch_lists" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "punch_lists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "punch_lists_obra_id_idx" ON "punch_lists"("obra_id");

ALTER TABLE "punch_lists" ADD CONSTRAINT "punch_lists_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "punch_lists" ADD CONSTRAINT "punch_lists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable punch_list_items (sem origem/ata_origem_id/prazo — vêm em 20260620230000)
CREATE TABLE "punch_list_items" (
    "id" UUID NOT NULL,
    "punch_list_id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsible_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'aberto',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "punch_list_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "punch_list_items_punch_list_id_idx" ON "punch_list_items"("punch_list_id");

ALTER TABLE "punch_list_items" ADD CONSTRAINT "punch_list_items_punch_list_id_fkey" FOREIGN KEY ("punch_list_id") REFERENCES "punch_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "punch_list_items" ADD CONSTRAINT "punch_list_items_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
