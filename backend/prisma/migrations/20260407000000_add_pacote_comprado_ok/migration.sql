ALTER TABLE "compras_metas" ADD COLUMN "pacote" INTEGER;
ALTER TABLE "compras_metas" ADD COLUMN "comprado_ok" BOOLEAN NOT NULL DEFAULT false;
