-- Módulo Qualidade · Vistoria de Obra (03/09/26) — digitaliza o Checklist
-- MODELO.xlsx (9 categorias com pesos, Sim/Não/N/A, nota 0–5 ponderada).
CREATE TABLE "qualidade_vistorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "vistoriador_id" UUID,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota_final" DECIMAL(4,2) NOT NULL,
    "classificacao" VARCHAR(20) NOT NULL,
    "resumo" JSONB NOT NULL,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qualidade_vistorias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "qualidade_vistoria_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vistoria_id" UUID NOT NULL,
    "categoria_key" VARCHAR(30) NOT NULL,
    "item_key" VARCHAR(30) NOT NULL,
    "texto" TEXT NOT NULL,
    "resposta" VARCHAR(3) NOT NULL,
    "observacao" TEXT,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "resolvido_em" TIMESTAMP(3),
    "resolvido_por" UUID,

    CONSTRAINT "qualidade_vistoria_itens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "qualidade_vistorias_obra_id_data_idx" ON "qualidade_vistorias"("obra_id", "data");
CREATE INDEX "qualidade_vistoria_itens_vistoria_id_idx" ON "qualidade_vistoria_itens"("vistoria_id");

ALTER TABLE "qualidade_vistorias" ADD CONSTRAINT "qualidade_vistorias_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qualidade_vistorias" ADD CONSTRAINT "qualidade_vistorias_vistoriador_id_fkey"
    FOREIGN KEY ("vistoriador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qualidade_vistoria_itens" ADD CONSTRAINT "qualidade_vistoria_itens_vistoria_id_fkey"
    FOREIGN KEY ("vistoria_id") REFERENCES "qualidade_vistorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "qualidade_vistoria_itens" ADD CONSTRAINT "qualidade_vistoria_itens_resolvido_por_fkey"
    FOREIGN KEY ("resolvido_por") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
