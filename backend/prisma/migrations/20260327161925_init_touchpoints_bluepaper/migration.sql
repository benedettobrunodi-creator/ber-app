-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "enviado_cliente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enviado_em" TIMESTAMP(3),
ADD COLUMN     "obra_id" UUID,
ADD COLUMN     "semana_referencia" DATE,
ADD COLUMN     "template_data" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "tipo" VARCHAR(30) NOT NULL DEFAULT 'interno';

-- AlterTable
ALTER TABLE "checklist_templates" ADD COLUMN     "bluepaper_doc" INTEGER,
ADD COLUMN     "fase" VARCHAR(50),
ADD COLUMN     "responsible_role" VARCHAR(50);

-- AlterTable
ALTER TABLE "obras" ADD COLUMN     "fase" VARCHAR(50) NOT NULL DEFAULT 'kickoff_interno',
ADD COLUMN     "fase_updated_at" TIMESTAMP(3),
ADD COLUMN     "fase_updated_by" UUID;

-- CreateTable
CREATE TABLE "obra_fase_history" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "fase_anterior" VARCHAR(50),
    "fase_nova" VARCHAR(50) NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "obra_fase_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_touchpoints" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "conducted_by" UUID,
    "client_contacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "architect_contacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT,
    "next_action" TEXT,
    "next_action_due" DATE,
    "next_action_owner" UUID,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'realizado',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_touchpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "obra_fase_history_obra_id_changed_at_idx" ON "obra_fase_history"("obra_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "client_touchpoints_obra_id_occurred_at_idx" ON "client_touchpoints"("obra_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "client_touchpoints_next_action_due_idx" ON "client_touchpoints"("next_action_due");

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_fase_updated_by_fkey" FOREIGN KEY ("fase_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_fase_history" ADD CONSTRAINT "obra_fase_history_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_fase_history" ADD CONSTRAINT "obra_fase_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_touchpoints" ADD CONSTRAINT "client_touchpoints_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_touchpoints" ADD CONSTRAINT "client_touchpoints_conducted_by_fkey" FOREIGN KEY ("conducted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_touchpoints" ADD CONSTRAINT "client_touchpoints_next_action_owner_fkey" FOREIGN KEY ("next_action_owner") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_touchpoints" ADD CONSTRAINT "client_touchpoints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
