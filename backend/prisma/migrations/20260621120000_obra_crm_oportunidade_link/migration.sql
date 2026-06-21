-- AlterTable
ALTER TABLE "obras" ADD COLUMN "crm_oportunidade_id" UUID;

-- CreateIndex (unique constraint)
CREATE UNIQUE INDEX "obras_crm_oportunidade_id_key" ON "obras"("crm_oportunidade_id");

-- AddForeignKey
ALTER TABLE "obras" ADD CONSTRAINT "obras_crm_oportunidade_id_fkey"
  FOREIGN KEY ("crm_oportunidade_id") REFERENCES "crm_oportunidades"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
