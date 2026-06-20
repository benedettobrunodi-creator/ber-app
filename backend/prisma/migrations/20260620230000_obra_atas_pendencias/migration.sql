-- ObraAta + extensão PunchListItem (Gestão 360 — Sprint 1.4)

CREATE TABLE IF NOT EXISTS "obra_atas" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"        UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "tipo"           VARCHAR(10)  NOT NULL,
  "numero"         VARCHAR(20)  NOT NULL,
  "data"           DATE         NOT NULL,
  "local"          VARCHAR(255),
  "participantes"  JSONB        NOT NULL DEFAULT '[]',
  "pauta"          TEXT         NOT NULL,
  "decisoes"       TEXT,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "obra_atas_obra_id_idx" ON "obra_atas" ("obra_id");
CREATE INDEX IF NOT EXISTS "obra_atas_tipo_idx"    ON "obra_atas" ("tipo");

-- Extensão PunchListItem para suportar pendências unificadas
ALTER TABLE "punch_list_items"
  ADD COLUMN IF NOT EXISTS "origem"        VARCHAR(20) NOT NULL DEFAULT 'livre',
  ADD COLUMN IF NOT EXISTS "ata_origem_id" UUID REFERENCES "obra_atas"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "prazo"         DATE;

CREATE INDEX IF NOT EXISTS "punch_list_items_ata_origem_idx" ON "punch_list_items" ("ata_origem_id");
