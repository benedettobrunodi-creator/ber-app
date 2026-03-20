-- CreateTable
CREATE TABLE "canteiro_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteiro_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteiro_template_items" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "canteiro_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteiro_checklists" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "template_id" UUID,
    "week_start" DATE NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'em_andamento',
    "created_by" UUID,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canteiro_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteiro_checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "template_item_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "answer" VARCHAR(20),
    "photo_url" TEXT,
    "observation" TEXT,
    "answered_by" UUID,
    "answered_at" TIMESTAMP(3),

    CONSTRAINT "canteiro_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canteiro_template_items_template_id_idx" ON "canteiro_template_items"("template_id");

-- CreateIndex
CREATE INDEX "canteiro_checklists_obra_id_idx" ON "canteiro_checklists"("obra_id");

-- CreateIndex
CREATE UNIQUE INDEX "canteiro_checklists_obra_id_week_start_key" ON "canteiro_checklists"("obra_id", "week_start");

-- CreateIndex
CREATE INDEX "canteiro_checklist_items_checklist_id_idx" ON "canteiro_checklist_items"("checklist_id");

-- AddForeignKey
ALTER TABLE "canteiro_template_items" ADD CONSTRAINT "canteiro_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "canteiro_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklists" ADD CONSTRAINT "canteiro_checklists_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklists" ADD CONSTRAINT "canteiro_checklists_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "canteiro_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklists" ADD CONSTRAINT "canteiro_checklists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklists" ADD CONSTRAINT "canteiro_checklists_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklist_items" ADD CONSTRAINT "canteiro_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "canteiro_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklist_items" ADD CONSTRAINT "canteiro_checklist_items_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "canteiro_template_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteiro_checklist_items" ADD CONSTRAINT "canteiro_checklist_items_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
