-- Sprint 1.6: Cronograma de Contratações + Histograma de MO

CREATE TABLE IF NOT EXISTS "obra_contratacao_planos" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"        UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "pacote"         VARCHAR(150) NOT NULL,
  "data_ideal"     DATE,
  "data_limite"    DATE,
  "contratacao_id" UUID UNIQUE REFERENCES "obra_contratacoes"("id") ON DELETE SET NULL,
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'a_contratar',
  "observacoes"    TEXT,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "obra_contratacao_planos_obra_id_idx" ON "obra_contratacao_planos" ("obra_id");
CREATE INDEX IF NOT EXISTS "obra_contratacao_planos_status_idx"  ON "obra_contratacao_planos" ("status");

CREATE TABLE IF NOT EXISTS "obra_histograma" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"    UUID        NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "funcao"     VARCHAR(100) NOT NULL,
  "ano"        INTEGER     NOT NULL,
  "mes"        INTEGER     NOT NULL,
  "hh_plan"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hh_real"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("obra_id", "funcao", "ano", "mes")
);
CREATE INDEX IF NOT EXISTS "obra_histograma_obra_id_idx" ON "obra_histograma" ("obra_id");
