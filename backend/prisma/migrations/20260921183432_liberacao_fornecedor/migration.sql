-- CreateTable
CREATE TABLE "liberacoes_fornecedor" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "compras_meta_id" UUID NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "valor_autorizado" DECIMAL(14,2) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'solicitada',
    "data_pagamento" DATE,
    "observacoes" VARCHAR(500),
    "solicitado_por" UUID,
    "aprovado_financeiro_por" UUID,
    "aprovado_diretoria_por" UUID,
    "recusado_por" UUID,
    "motivo_recusa" VARCHAR(500),
    "email_enviado_em" TIMESTAMP(3),
    "email_destinatario" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liberacoes_fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "liberacoes_fornecedor_obra_id_status_idx" ON "liberacoes_fornecedor"("obra_id", "status");

-- CreateIndex
CREATE INDEX "liberacoes_fornecedor_compras_meta_id_idx" ON "liberacoes_fornecedor"("compras_meta_id");

-- AddForeignKey
ALTER TABLE "liberacoes_fornecedor" ADD CONSTRAINT "liberacoes_fornecedor_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberacoes_fornecedor" ADD CONSTRAINT "liberacoes_fornecedor_compras_meta_id_fkey" FOREIGN KEY ("compras_meta_id") REFERENCES "compras_metas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberacoes_fornecedor" ADD CONSTRAINT "liberacoes_fornecedor_solicitado_por_fkey" FOREIGN KEY ("solicitado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberacoes_fornecedor" ADD CONSTRAINT "liberacoes_fornecedor_aprovado_financeiro_por_fkey" FOREIGN KEY ("aprovado_financeiro_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberacoes_fornecedor" ADD CONSTRAINT "liberacoes_fornecedor_aprovado_diretoria_por_fkey" FOREIGN KEY ("aprovado_diretoria_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liberacoes_fornecedor" ADD CONSTRAINT "liberacoes_fornecedor_recusado_por_fkey" FOREIGN KEY ("recusado_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

