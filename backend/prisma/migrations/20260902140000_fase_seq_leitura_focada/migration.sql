-- Leitura focada do % do cronograma + correção manual da fase do Sequenciamento (02/09/26)
ALTER TABLE "cronogramas" ADD COLUMN "pct_focado" INTEGER;
ALTER TABLE "cronogramas" ADD COLUMN "pct_focado_em" TIMESTAMP(3);
ALTER TABLE "cronogramas" ADD COLUMN "pct_focado_fonte" VARCHAR(120);
ALTER TABLE "obras" ADD COLUMN "fase_seq_manual" VARCHAR(4);
