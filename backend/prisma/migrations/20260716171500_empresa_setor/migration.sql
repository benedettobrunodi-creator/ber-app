-- CrmEmpresa: setor de mercado (Financeiro, Advocacia, Tech, etc.)
ALTER TABLE "crm_empresas" ADD COLUMN "setor" VARCHAR(60);

CREATE INDEX "crm_empresas_setor_idx" ON "crm_empresas" ("setor");
