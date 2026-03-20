-- CreateTable
CREATE TABLE "instrucoes_tecnicas" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "discipline" VARCHAR(50) NOT NULL,
    "objective" TEXT,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "attention_points" JSONB NOT NULL DEFAULT '[]',
    "approval_criteria" JSONB NOT NULL DEFAULT '[]',
    "related_normas" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instrucoes_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instrucoes_tecnicas_code_key" ON "instrucoes_tecnicas"("code");

-- CreateIndex
CREATE INDEX "instrucoes_tecnicas_discipline_idx" ON "instrucoes_tecnicas"("discipline");

-- CreateIndex
CREATE INDEX "instrucoes_tecnicas_status_idx" ON "instrucoes_tecnicas"("status");

-- AddForeignKey
ALTER TABLE "instrucoes_tecnicas" ADD CONSTRAINT "instrucoes_tecnicas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrucoes_tecnicas" ADD CONSTRAINT "instrucoes_tecnicas_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
