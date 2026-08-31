-- Durante a Obra · Controle de Documentos (31/08/26)
-- Documento + histórico de revisões normalizado (1 linha por revisão, sem
-- limite, arquivo próprio por versão). Código único por obra evita duplicidade
-- (achado real numa planilha de controle analisada pelo Bruno).

CREATE TABLE "projeto_documentos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "obra_id" UUID NOT NULL,
  "codigo" VARCHAR(150) NOT NULL,
  "titulo" VARCHAR(255),
  "disciplina" VARCHAR(80) NOT NULL,
  "projetista" VARCHAR(150),
  "etapa" VARCHAR(40),
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "projeto_documentos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projeto_documento_revisoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "documento_id" UUID NOT NULL,
  "revisao" VARCHAR(20) NOT NULL,
  "data" DATE NOT NULL,
  "arquivo_url" TEXT,
  "arquivo_nome" VARCHAR(255),
  "observacao" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "projeto_documento_revisoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projeto_documentos_obra_id_idx" ON "projeto_documentos"("obra_id");
CREATE UNIQUE INDEX "projeto_documentos_obra_id_codigo_key" ON "projeto_documentos"("obra_id", "codigo");
CREATE INDEX "projeto_documento_revisoes_documento_id_idx" ON "projeto_documento_revisoes"("documento_id");

ALTER TABLE "projeto_documentos" ADD CONSTRAINT "projeto_documentos_obra_id_fkey"
  FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projeto_documentos" ADD CONSTRAINT "projeto_documentos_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projeto_documento_revisoes" ADD CONSTRAINT "projeto_documento_revisoes_documento_id_fkey"
  FOREIGN KEY ("documento_id") REFERENCES "projeto_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projeto_documento_revisoes" ADD CONSTRAINT "projeto_documento_revisoes_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
