-- CreateTable
CREATE TABLE "cronogramas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "parsed_at" TIMESTAMP(3),
    "parsed_data" JSONB,
    "progress_pct" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cronogramas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cronogramas_obra_id_idx" ON "cronogramas"("obra_id");

-- AddForeignKey
ALTER TABLE "cronogramas" ADD CONSTRAINT "cronogramas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "obra_tasks" ADD COLUMN "cronograma_ref" VARCHAR(100);
