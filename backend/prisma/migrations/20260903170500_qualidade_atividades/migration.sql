-- Atividades em execução no momento da vistoria (03/09/26, pedido Bruno).
ALTER TABLE "qualidade_vistorias" ADD COLUMN "atividades" JSONB NOT NULL DEFAULT '[]';
