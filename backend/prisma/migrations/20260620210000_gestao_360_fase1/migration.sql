-- Gestão 360 — Fase 1
-- 1) Campos novos em obras
-- 2) Tabela polimórfica de anexos

ALTER TABLE "obras"
  ADD COLUMN IF NOT EXISTS "arquitetura_escritorio" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "gerenciadora"           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "area_m2"                DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "attachments" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type"   VARCHAR(50)  NOT NULL,
  "entity_id"     UUID         NOT NULL,
  "file_name"     VARCHAR(255) NOT NULL,
  "file_url"      TEXT         NOT NULL,
  "mime_type"     VARCHAR(100),
  "size_bytes"    INTEGER,
  "uploaded_by"   UUID,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "attachments_entity_type_entity_id_idx"
  ON "attachments" ("entity_type", "entity_id");
