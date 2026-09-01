-- FVS (Sequenciamento): responsável por área no template + prazo por item
-- da obra, base pro gatilho de e-mail de item em aberto vencido (01/09/26).

ALTER TABLE "fvs_template_items" ADD COLUMN "responsavel_area" VARCHAR(20);
ALTER TABLE "obra_fvs_items" ADD COLUMN "data_limite" DATE;
