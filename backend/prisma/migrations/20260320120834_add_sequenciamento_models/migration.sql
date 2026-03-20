-- CreateTable
CREATE TABLE "sequenciamento_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "segment" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sequenciamento_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequenciamento_etapas" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "discipline" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "estimated_days" INTEGER NOT NULL DEFAULT 0,
    "depends_on" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_checklists" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "sequenciamento_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_sequenciamentos" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "template_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obra_sequenciamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obra_etapas" (
    "id" UUID NOT NULL,
    "sequenciamento_id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "template_etapa_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "discipline" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "estimated_days" INTEGER NOT NULL DEFAULT 0,
    "depends_on" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "estimated_end_date" TIMESTAMP(3),
    "status" VARCHAR(50) NOT NULL DEFAULT 'nao_iniciada',
    "gestor_notes" TEXT,
    "coordenador_notes" TEXT,
    "submitted_by" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejected_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,

    CONSTRAINT "obra_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sequenciamento_etapas_template_id_idx" ON "sequenciamento_etapas"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "obra_sequenciamentos_obra_id_key" ON "obra_sequenciamentos"("obra_id");

-- CreateIndex
CREATE INDEX "obra_etapas_sequenciamento_id_idx" ON "obra_etapas"("sequenciamento_id");

-- CreateIndex
CREATE INDEX "obra_etapas_obra_id_idx" ON "obra_etapas"("obra_id");

-- AddForeignKey
ALTER TABLE "sequenciamento_etapas" ADD CONSTRAINT "sequenciamento_etapas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sequenciamento_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_sequenciamentos" ADD CONSTRAINT "obra_sequenciamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_sequenciamentos" ADD CONSTRAINT "obra_sequenciamentos_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sequenciamento_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_sequenciamentos" ADD CONSTRAINT "obra_sequenciamentos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_etapas" ADD CONSTRAINT "obra_etapas_sequenciamento_id_fkey" FOREIGN KEY ("sequenciamento_id") REFERENCES "obra_sequenciamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_etapas" ADD CONSTRAINT "obra_etapas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_etapas" ADD CONSTRAINT "obra_etapas_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_etapas" ADD CONSTRAINT "obra_etapas_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_etapas" ADD CONSTRAINT "obra_etapas_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
