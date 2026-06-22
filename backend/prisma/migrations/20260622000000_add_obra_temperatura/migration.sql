-- CreateTable obra_temperatura — satisfação do cliente em momentos da obra
-- tipo: pos_venda | pos_kickoff | quinzenal | entrega_substancial | entrega_final
-- avaliacao: Muito Ruim | Ruim | Regular | Bom | Muito Bom | Ótimo
CREATE TABLE "obra_temperatura" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "data" DATE NOT NULL,
    "avaliacao" VARCHAR(30) NOT NULL,
    "observacao" TEXT,
    "preenchido_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "obra_temperatura_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obra_temperatura_obra_id_data_idx" ON "obra_temperatura"("obra_id", "data" DESC);

ALTER TABLE "obra_temperatura" ADD CONSTRAINT "obra_temperatura_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obra_temperatura" ADD CONSTRAINT "obra_temperatura_preenchido_por_id_fkey" FOREIGN KEY ("preenchido_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
