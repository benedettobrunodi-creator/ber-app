-- AlterTable CrmEmpresa: add agendorId
ALTER TABLE "crm_empresas" ADD COLUMN "agendor_id" VARCHAR(50);
CREATE UNIQUE INDEX "crm_empresas_agendor_id_key" ON "crm_empresas"("agendor_id");

-- AlterTable CrmContato: add whatsapp, linkedin, aniversario, agendorId
ALTER TABLE "crm_contatos" ADD COLUMN "whatsapp" VARCHAR(30);
ALTER TABLE "crm_contatos" ADD COLUMN "linkedin" VARCHAR(255);
ALTER TABLE "crm_contatos" ADD COLUMN "aniversario" DATE;
ALTER TABLE "crm_contatos" ADD COLUMN "agendor_id" VARCHAR(50);
CREATE UNIQUE INDEX "crm_contatos_agendor_id_key" ON "crm_contatos"("agendor_id");
