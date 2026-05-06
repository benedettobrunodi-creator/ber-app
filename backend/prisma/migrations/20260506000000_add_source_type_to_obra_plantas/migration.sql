-- CreateTable obra_plantas if not exists
CREATE TABLE IF NOT EXISTS "obra_plantas" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "obra_id"     UUID        NOT NULL,
    "file_url"    TEXT        NOT NULL,
    "pages"       JSONB,
    "name"        VARCHAR(120),
    "source_type" VARCHAR(20) NOT NULL DEFAULT 'pdf',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obra_plantas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "obra_plantas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE
);

-- CreateTable obra_ambientes if not exists
CREATE TABLE IF NOT EXISTS "obra_ambientes" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "obra_id"     UUID         NOT NULL,
    "planta_id"   UUID,
    "page_index"  INTEGER      NOT NULL DEFAULT 0,
    "nome"        VARCHAR(100) NOT NULL,
    "pos_x"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pos_y"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cor"         VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obra_ambientes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "obra_ambientes_obra_id_fkey"   FOREIGN KEY ("obra_id")   REFERENCES "obras"("id")         ON DELETE CASCADE,
    CONSTRAINT "obra_ambientes_planta_id_fkey" FOREIGN KEY ("planta_id") REFERENCES "obra_plantas"("id")  ON DELETE SET NULL
);

-- CreateTable obra_fotos if not exists
CREATE TABLE IF NOT EXISTS "obra_fotos" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "obra_id"      UUID         NOT NULL,
    "ambiente_id"  UUID,
    "categoria"    VARCHAR(50)  NOT NULL DEFAULT 'geral',
    "file_url"     TEXT         NOT NULL,
    "legenda"      TEXT,
    "tirada_por"   UUID,
    "tirada_em"    DATE,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obra_fotos_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "obra_fotos_obra_id_fkey"      FOREIGN KEY ("obra_id")     REFERENCES "obras"("id")          ON DELETE CASCADE,
    CONSTRAINT "obra_fotos_ambiente_id_fkey"  FOREIGN KEY ("ambiente_id") REFERENCES "obra_ambientes"("id") ON DELETE SET NULL,
    CONSTRAINT "obra_fotos_tirada_por_fkey"   FOREIGN KEY ("tirada_por")  REFERENCES "users"("id")          ON DELETE SET NULL
);

-- Add missing columns to existing obra_plantas (for DBs created via db push without source_type/name)
ALTER TABLE "obra_plantas"
    ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(20) NOT NULL DEFAULT 'pdf',
    ADD COLUMN IF NOT EXISTS "name"        VARCHAR(120);
