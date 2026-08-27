-- Split: receber diário × receber relatório (backfill do recebe_emails)
ALTER TABLE "obra_stakeholders" ADD COLUMN "recebe_diario" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "obra_stakeholders" ADD COLUMN "recebe_relatorio" BOOLEAN NOT NULL DEFAULT false;
UPDATE "obra_stakeholders" SET "recebe_diario" = "recebe_emails", "recebe_relatorio" = "recebe_emails";
