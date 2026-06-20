-- Sprint 1.5: Documentos, Stakeholders, Kickoff, RACI

CREATE TABLE IF NOT EXISTS "obra_documentos" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"        UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "tipo"           VARCHAR(50)  NOT NULL,
  "nome"           VARCHAR(255) NOT NULL,
  "revisao"        VARCHAR(20),
  "emitido_por"    VARCHAR(255),
  "data_emissao"   DATE,
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'em_analise',
  "aprovado_em"    TIMESTAMPTZ,
  "aprovado_por"   UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "observacoes"    TEXT,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "obra_documentos_obra_id_idx" ON "obra_documentos" ("obra_id");
CREATE INDEX IF NOT EXISTS "obra_documentos_status_idx"  ON "obra_documentos" ("status");

CREATE TABLE IF NOT EXISTS "obra_stakeholders" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"    UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "empresa"    VARCHAR(255) NOT NULL,
  "nome"       VARCHAR(255) NOT NULL,
  "cargo"      VARCHAR(150),
  "email"      VARCHAR(255),
  "telefone"   VARCHAR(50),
  "funcao"     VARCHAR(150),
  "ordem"      INTEGER      NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "obra_stakeholders_obra_id_idx" ON "obra_stakeholders" ("obra_id");

CREATE TABLE IF NOT EXISTS "obra_kickoffs" (
  "id"              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"         UUID         NOT NULL UNIQUE REFERENCES "obras"("id") ON DELETE CASCADE,
  "data_realizada"  DATE,
  "participantes"   JSONB        NOT NULL DEFAULT '[]',
  "pauta_coberta"   TEXT,
  "decisoes"        TEXT,
  "premissas"       TEXT,
  "riscos_iniciais" TEXT,
  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "obra_raci" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"    UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "atividade"  VARCHAR(255) NOT NULL,
  "ordem"      INTEGER      NOT NULL DEFAULT 0,
  "papeis"     JSONB        NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "obra_raci_obra_id_idx" ON "obra_raci" ("obra_id");
