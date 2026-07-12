-- Ata Corrida: elimina reuniao como entidade e adota timeline por tópico.
-- Como não há dados cadastrados (Bruno confirmou 2026-07-12), drop direto.

DROP TABLE IF EXISTS "obra_ata_notas";
DROP TABLE IF EXISTS "obra_ata_reunioes";

-- Renomeio triplo pra trocar "tema" e "area" de posição sem colisão:
--   antes: tema (Text, coluna 1 na UI)  |  area (VarChar 150, coluna 2 na UI)
--   depois: disciplina (VarChar 150)   |  tema (Text)
ALTER TABLE "obra_ata_topicos" RENAME COLUMN "tema" TO "tema_old";
ALTER TABLE "obra_ata_topicos" RENAME COLUMN "area" TO "tema";
ALTER TABLE "obra_ata_topicos" RENAME COLUMN "tema_old" TO "disciplina";

-- Ajusta tipos aos novos propósitos
ALTER TABLE "obra_ata_topicos" ALTER COLUMN "disciplina" TYPE VARCHAR(150);
ALTER TABLE "obra_ata_topicos" ALTER COLUMN "tema" TYPE TEXT;

-- Novo campo de observações (texto livre)
ALTER TABLE "obra_ata_topicos"
  ADD COLUMN "observacoes" TEXT;

-- Nova tabela: cada tópico tem sua própria timeline de atualizações
CREATE TABLE "obra_ata_topico_atualizacoes" (
  "id"         UUID        PRIMARY KEY,
  "topico_id"  UUID        NOT NULL,
  "data"       DATE        NOT NULL,
  "texto"      TEXT        NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_ata_topico_atualizacoes_topico_id_fkey"
    FOREIGN KEY ("topico_id") REFERENCES "obra_ata_topicos"("id") ON DELETE CASCADE
);

CREATE INDEX "obra_ata_topico_atualizacoes_topico_id_data_idx"
  ON "obra_ata_topico_atualizacoes"("topico_id", "data");
