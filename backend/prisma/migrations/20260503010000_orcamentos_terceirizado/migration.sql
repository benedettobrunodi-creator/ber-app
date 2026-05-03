-- AlterTable: add terceirizado flag to orcamentos
ALTER TABLE "orcamentos" ADD COLUMN "terceirizado" BOOLEAN NOT NULL DEFAULT false;
