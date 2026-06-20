-- ObraContratacao + ObraOrdemCompra (Gestão 360 — Sprint 1.3)

CREATE TABLE IF NOT EXISTS "obra_contratacoes" (
  "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"          UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "fornecedor"       VARCHAR(255) NOT NULL,
  "disciplina"       VARCHAR(100),
  "valor"            DECIMAL(14,2) NOT NULL,
  "data_assinatura"  DATE,
  "vigencia_inicio"  DATE,
  "vigencia_fim"     DATE,
  "status"           VARCHAR(20)  NOT NULL DEFAULT 'em_negociacao',
  "observacoes"      TEXT,
  "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "obra_contratacoes_obra_id_idx" ON "obra_contratacoes" ("obra_id");
CREATE INDEX IF NOT EXISTS "obra_contratacoes_status_idx"  ON "obra_contratacoes" ("status");

CREATE TABLE IF NOT EXISTS "obra_ordens_compra" (
  "id"                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"                UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "contratacao_id"         UUID         REFERENCES "obra_contratacoes"("id") ON DELETE SET NULL,
  "numero"                 VARCHAR(30)  NOT NULL,
  "fornecedor"             VARCHAR(255) NOT NULL,
  "descricao"              TEXT         NOT NULL,
  "valor"                  DECIMAL(14,2) NOT NULL,
  "data_emissao"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "data_prevista_entrega"  DATE,
  "data_entrega_real"      DATE,
  "status"                 VARCHAR(20)  NOT NULL DEFAULT 'aberta',
  "observacoes"            TEXT,
  "created_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "obra_ordens_compra_obra_id_idx"       ON "obra_ordens_compra" ("obra_id");
CREATE INDEX IF NOT EXISTS "obra_ordens_compra_contratacao_idx"   ON "obra_ordens_compra" ("contratacao_id");
CREATE INDEX IF NOT EXISTS "obra_ordens_compra_status_idx"        ON "obra_ordens_compra" ("status");
