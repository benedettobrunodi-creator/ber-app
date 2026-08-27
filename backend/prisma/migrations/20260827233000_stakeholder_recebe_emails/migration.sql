-- Stakeholder pode ser marcado pra receber diários/relatórios por e-mail
ALTER TABLE "obra_stakeholders" ADD COLUMN "recebe_emails" BOOLEAN NOT NULL DEFAULT false;
