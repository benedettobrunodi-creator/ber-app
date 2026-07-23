-- Célula pode ser fórmula-soma: array de refs {linhaId, mes}.
ALTER TABLE "public"."fin_valores" ADD COLUMN "formula" JSONB;
ALTER TABLE "public"."fin_valores" ALTER COLUMN "valor" DROP NOT NULL;
