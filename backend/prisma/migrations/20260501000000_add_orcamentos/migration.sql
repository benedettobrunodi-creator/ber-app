-- CreateTable orcamentos
CREATE TABLE "orcamentos" (
  "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
  "numero"          VARCHAR(20)   NOT NULL,
  "cliente"         VARCHAR(255)  NOT NULL,
  "descricao_curta" VARCHAR(500),
  "m2"              DOUBLE PRECISION,
  "valor_venda"     DECIMAL(14,2),
  "segmento"        VARCHAR(50),
  "estrategico"     BOOLEAN       NOT NULL DEFAULT false,
  "status"          VARCHAR(50)   NOT NULL,
  "categoria"       VARCHAR(50)   NOT NULL,
  "data_inicio"     DATE,
  "data_fim"        DATE,
  "data_entrega"    DATE,
  "responsavel_id"  UUID,
  "observacoes"     TEXT,
  "change_order_de" UUID,
  "created_by_id"   UUID          NOT NULL,
  "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable orcamento_historico
CREATE TABLE "orcamento_historico" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "orcamento_id" UUID          NOT NULL,
  "campo"        VARCHAR(100)  NOT NULL,
  "valor_antigo" TEXT,
  "valor_novo"   TEXT,
  "alterado_por" VARCHAR(255)  NOT NULL,
  "alterado_em"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orcamento_historico_pkey" PRIMARY KEY ("id")
);

-- Unique
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_numero_key" UNIQUE ("numero");

-- Indexes
CREATE INDEX "orcamentos_status_idx"            ON "orcamentos"("status");
CREATE INDEX "orcamentos_categoria_idx"          ON "orcamentos"("categoria");
CREATE INDEX "orcamentos_data_idx"              ON "orcamentos"("data_inicio", "data_fim");
CREATE INDEX "orcamento_historico_orc_id_idx"   ON "orcamento_historico"("orcamento_id");

-- Foreign keys
ALTER TABLE "orcamentos"
  ADD CONSTRAINT "orcamentos_responsavel_id_fkey"
    FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orcamentos"
  ADD CONSTRAINT "orcamentos_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamentos"
  ADD CONSTRAINT "orcamentos_change_order_de_fkey"
    FOREIGN KEY ("change_order_de") REFERENCES "orcamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orcamento_historico"
  ADD CONSTRAINT "orcamento_historico_orcamento_id_fkey"
    FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- updated_at trigger (PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_orcamentos_updated_at
  BEFORE UPDATE ON "orcamentos"
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
