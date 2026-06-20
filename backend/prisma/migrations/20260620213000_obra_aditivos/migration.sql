-- ObraAditivo — formaliza mudanças contratuais (Change Orders)

CREATE TABLE IF NOT EXISTS "obra_aditivos" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"        UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "numero"         VARCHAR(20)  NOT NULL,
  "descricao"      TEXT         NOT NULL,
  "valor"          DECIMAL(14,2) NOT NULL,
  "tipo"           VARCHAR(20)  NOT NULL,
  "motivo"         TEXT,
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'em_analise',
  "data_abertura"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "data_decisao"   TIMESTAMPTZ,
  "decidido_por"   UUID         REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "obra_aditivos_obra_id_idx" ON "obra_aditivos" ("obra_id");
CREATE INDEX IF NOT EXISTS "obra_aditivos_status_idx"  ON "obra_aditivos" ("status");
