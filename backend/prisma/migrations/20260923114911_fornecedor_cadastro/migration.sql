-- AlterTable
ALTER TABLE "compras_metas" ADD COLUMN     "fornecedor_cadastro_id" UUID;

-- AlterTable
ALTER TABLE "obra_contratacao_planos" ADD COLUMN     "fornecedor_cadastro_id" UUID;

-- CreateTable
CREATE TABLE "fornecedores_cadastro" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "nome_norm" VARCHAR(255) NOT NULL,
    "cnpj" VARCHAR(20),
    "contato" VARCHAR(150),
    "telefone" VARCHAR(40),
    "email" VARCHAR(150),
    "observacoes" VARCHAR(500),
    "criado_por" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_cadastro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_cadastro_nome_norm_key" ON "fornecedores_cadastro"("nome_norm");

-- AddForeignKey
ALTER TABLE "fornecedores_cadastro" ADD CONSTRAINT "fornecedores_cadastro_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_metas" ADD CONSTRAINT "compras_metas_fornecedor_cadastro_id_fkey" FOREIGN KEY ("fornecedor_cadastro_id") REFERENCES "fornecedores_cadastro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obra_contratacao_planos" ADD CONSTRAINT "obra_contratacao_planos_fornecedor_cadastro_id_fkey" FOREIGN KEY ("fornecedor_cadastro_id") REFERENCES "fornecedores_cadastro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

