-- Ajuste manual de ponto pode apontar centro de custo (obra)
ALTER TABLE "ajustes_ponto" ADD COLUMN "obra_id" UUID;
ALTER TABLE "ajustes_ponto" ADD CONSTRAINT "ajustes_ponto_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
