-- Adiciona campos pra sub-linhas C/D de Change Order funcionarem como itens de compra completos
ALTER TABLE "compras_splits"
  ADD COLUMN "descricao"     TEXT,
  ADD COLUMN "pct_meta"      DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  ADD COLUMN "comprado"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "comprado_ok"   BOOLEAN          NOT NULL DEFAULT false;

-- Legado: em splits de CO (coTipo != null) o campo "fornecedor" foi usado como
-- descrição do item (placeholder era "Descrição do item..."). Migra pra coluna
-- própria e libera "fornecedor" pra armazenar o nome real do fornecedor.
UPDATE "compras_splits"
SET "descricao" = "fornecedor",
    "fornecedor" = NULL
WHERE "co_tipo" IS NOT NULL
  AND "fornecedor" IS NOT NULL;
