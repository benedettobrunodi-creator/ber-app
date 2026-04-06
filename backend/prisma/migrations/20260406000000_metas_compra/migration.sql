CREATE TABLE "compras_metas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "obra_id" UUID NOT NULL,
  "n" VARCHAR(20),
  "categoria" VARCHAR(200) NOT NULL,
  "descritivo" VARCHAR(500),
  "venda" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pct_meta" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "comprado" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fornecedor" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compras_metas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_compras_metas_obra" ON "compras_metas"("obra_id");
ALTER TABLE "compras_metas" ADD CONSTRAINT "compras_metas_obra_id_fkey"
  FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
