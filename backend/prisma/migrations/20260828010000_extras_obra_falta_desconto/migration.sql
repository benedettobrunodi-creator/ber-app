-- Bloco 3: obra na hora extra + desconto de falta sem saldo
ALTER TABLE "hora_extra_registros" ADD COLUMN "obra_id" UUID;
ALTER TABLE "hora_extra_registros" ADD CONSTRAINT "hora_extra_registros_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "falta_descontos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "data" DATE NOT NULL,
  "minutos" INTEGER NOT NULL,
  "detalhe" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "falta_descontos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "falta_descontos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "falta_descontos_user_id_data_key" ON "falta_descontos"("user_id", "data");
