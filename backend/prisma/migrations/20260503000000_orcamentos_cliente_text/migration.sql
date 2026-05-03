-- AlterTable: remove VarChar(255) limit on orcamentos.cliente
ALTER TABLE "orcamentos" ALTER COLUMN "cliente" TYPE TEXT;
