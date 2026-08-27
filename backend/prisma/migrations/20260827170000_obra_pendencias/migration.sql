-- Pós-Obra · Pendências (Ficha de Pendências digitalizada)
CREATE TABLE "obra_pendencias" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "obra_id" UUID NOT NULL,
  "ambiente" VARCHAR(120) NOT NULL,
  "atividade" TEXT NOT NULL,
  "disciplina" VARCHAR(60),
  "fornecedor" VARCHAR(120),
  "apontado_por" VARCHAR(10) NOT NULL DEFAULT 'ber',
  "responsavel_id" UUID,
  "tipo" VARCHAR(15) NOT NULL DEFAULT 'pendencia',
  "criticidade" VARCHAR(10) NOT NULL DEFAULT 'media',
  "status" VARCHAR(15) NOT NULL DEFAULT 'aberta',
  "motivo_bloqueio" TEXT,
  "data_inicio" DATE,
  "data_termino" DATE,
  "foto_abertura_url" TEXT,
  "foto_conclusao_url" TEXT,
  "observacoes" TEXT,
  "concluida_em" TIMESTAMP(3),
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_pendencias_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obra_pendencias_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "obra_pendencias_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "obra_pendencias_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "obra_pendencias_obra_id_idx" ON "obra_pendencias"("obra_id");
CREATE INDEX "obra_pendencias_obra_id_status_idx" ON "obra_pendencias"("obra_id", "status");
