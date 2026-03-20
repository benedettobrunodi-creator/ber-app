-- CreateTable
CREATE TABLE "recebimento_materiais" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "fornecedor" VARCHAR(255) NOT NULL,
    "material" VARCHAR(255) NOT NULL,
    "quantidade" DECIMAL(12,2) NOT NULL,
    "unidade" VARCHAR(30) NOT NULL,
    "numero_nf" VARCHAR(50),
    "data_nf" DATE,
    "data_entrega" DATE NOT NULL,
    "condicao" VARCHAR(30) NOT NULL DEFAULT 'aprovado',
    "observacao" TEXT,
    "fotos_material" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "foto_nf" TEXT,
    "registrado_por" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recebimento_materiais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recebimento_materiais_obra_id_idx" ON "recebimento_materiais"("obra_id");

-- AddForeignKey
ALTER TABLE "recebimento_materiais" ADD CONSTRAINT "recebimento_materiais_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimento_materiais" ADD CONSTRAINT "recebimento_materiais_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
