-- AlterTable
ALTER TABLE "obra_etapas" ADD COLUMN     "evidencia_descricao" TEXT,
ADD COLUMN     "evidencia_fotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "evidencia_registrada_em" TIMESTAMP(3);
