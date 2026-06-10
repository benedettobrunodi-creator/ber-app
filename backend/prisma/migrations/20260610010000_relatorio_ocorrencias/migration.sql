CREATE TABLE IF NOT EXISTS "relatorio_ocorrencias" (
  "id"            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "relatorio_id"  UUID         NOT NULL REFERENCES "relatorios_semanais"("id") ON DELETE CASCADE,
  "data"          DATE         NOT NULL,
  "descricao"     TEXT         NOT NULL,
  "acao_tomada"   TEXT,
  "responsavel"   VARCHAR(255),
  "status"        VARCHAR(20)  NOT NULL DEFAULT 'em_andamento',
  "ordem"         INTEGER      NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "relatorio_ocorrencias_relatorio_id_idx" ON "relatorio_ocorrencias"("relatorio_id");
