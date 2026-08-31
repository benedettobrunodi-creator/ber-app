-- Alocação de mão de obra: permitir alocar recurso em oportunidade de PIPELINE
-- (alta probabilidade, ainda sem obra criada), não só em obra já contratada.
-- Mudança 100% aditiva: obra_id passa a aceitar NULL, novas colunas com default
-- seguro ("contratada" = comportamento atual, todas as linhas existentes).

-- AlterTable: obra_id vira opcional
ALTER TABLE "alocacoes" ALTER COLUMN "obra_id" DROP NOT NULL;

-- AlterTable: novas colunas (origem + vínculo opcional com oportunidade)
ALTER TABLE "alocacoes" ADD COLUMN "crm_oportunidade_id" UUID;
ALTER TABLE "alocacoes" ADD COLUMN "origem_tipo" VARCHAR(20) NOT NULL DEFAULT 'contratada';

-- Index
CREATE INDEX "alocacoes_crm_oportunidade_id_idx" ON "alocacoes"("crm_oportunidade_id");

-- FK (mesma política das demais FKs de Alocacao: cascade on delete)
ALTER TABLE "alocacoes" ADD CONSTRAINT "alocacoes_crm_oportunidade_id_fkey"
  FOREIGN KEY ("crm_oportunidade_id") REFERENCES "crm_oportunidades"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Garantia de integridade: toda alocação tem obra OU oportunidade (nunca as duas, nunca nenhuma)
ALTER TABLE "alocacoes" ADD CONSTRAINT "alocacoes_origem_check"
  CHECK (
    (obra_id IS NOT NULL AND crm_oportunidade_id IS NULL)
    OR (obra_id IS NULL AND crm_oportunidade_id IS NOT NULL)
  );
