-- Flag de documento obsoleto no Controle de Documentos (02/09/26)
ALTER TABLE "projeto_documentos" ADD COLUMN "obsoleto" BOOLEAN NOT NULL DEFAULT false;
