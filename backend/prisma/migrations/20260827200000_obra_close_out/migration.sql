-- Pós-Obra · Close Out — checklist de docs que compila o Manual do Proprietário
CREATE TABLE "obra_close_out_itens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "obra_id" UUID NOT NULL,
  "categoria" VARCHAR(30) NOT NULL,
  "titulo" VARCHAR(200) NOT NULL,
  "descricao" TEXT,
  "fornecedor" VARCHAR(120),
  "status" VARCHAR(15) NOT NULL DEFAULT 'pendente',
  "arquivo_url" TEXT,
  "arquivo_nome" VARCHAR(255),
  "validade" DATE,
  "recebido_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "obra_close_out_itens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "obra_close_out_itens_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "obra_close_out_itens_obra_id_idx" ON "obra_close_out_itens"("obra_id");
