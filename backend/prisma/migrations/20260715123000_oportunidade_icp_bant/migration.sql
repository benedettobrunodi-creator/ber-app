-- CrmOportunidade: checklists de qualificação ICP + BANT
ALTER TABLE "crm_oportunidades"
  ADD COLUMN "icp_estrategico"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icp_localizacao"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icp_ticket"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "icp_ciclo"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bant_budget"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bant_authority"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bant_need"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bant_timeline"    BOOLEAN NOT NULL DEFAULT false;
