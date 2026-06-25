-- Ata Corrida: substitui modelo "uma ata por reunião" por estrutura de
-- tópicos perenes (linhas) × reuniões (colunas), com notas na junção.

-- 1) Limpar referências ao modelo antigo
ALTER TABLE "punch_list_items" DROP CONSTRAINT IF EXISTS "punch_list_items_ata_origem_id_fkey";
DROP INDEX IF EXISTS "punch_list_items_ata_origem_idx";
ALTER TABLE "punch_list_items" DROP COLUMN IF EXISTS "ata_origem_id";

-- 2) Drop tabela antiga
DROP TABLE IF EXISTS "obra_atas";

-- 3) Tópico (linha da planilha)
CREATE TABLE "obra_ata_topicos" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"        UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "ordem"          INTEGER      NOT NULL DEFAULT 0,
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'em_andamento',
  "impacto"        VARCHAR(20)  NOT NULL DEFAULT 'sem_impacto',
  "change_order"   BOOLEAN      NOT NULL DEFAULT FALSE,
  "tema"           TEXT,
  "area"           VARCHAR(150),
  "responsavel_id" UUID         REFERENCES "users"("id"),
  "data_info"      DATE,
  "data_alvo"      DATE,
  "data_final"     DATE,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX "obra_ata_topicos_obra_id_idx" ON "obra_ata_topicos" ("obra_id");

-- 4) Reunião (coluna da planilha)
CREATE TABLE "obra_ata_reunioes" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "obra_id"    UUID         NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "data"       DATE         NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "obra_ata_reunioes_obra_id_data_key" ON "obra_ata_reunioes" ("obra_id", "data");
CREATE INDEX "obra_ata_reunioes_obra_id_idx" ON "obra_ata_reunioes" ("obra_id");

-- 5) Nota (célula da planilha — junção tópico × reunião)
CREATE TABLE "obra_ata_notas" (
  "id"         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "topico_id"  UUID         NOT NULL REFERENCES "obra_ata_topicos"("id") ON DELETE CASCADE,
  "reuniao_id" UUID         NOT NULL REFERENCES "obra_ata_reunioes"("id") ON DELETE CASCADE,
  "texto"      TEXT         NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "obra_ata_notas_topico_id_reuniao_id_key" ON "obra_ata_notas" ("topico_id", "reuniao_id");
CREATE INDEX "obra_ata_notas_topico_id_idx" ON "obra_ata_notas" ("topico_id");
CREATE INDEX "obra_ata_notas_reuniao_id_idx" ON "obra_ata_notas" ("reuniao_id");
