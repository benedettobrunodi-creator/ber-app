CREATE TABLE "compras_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "comissao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compras_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compras_config_obra_id_key" ON "compras_config"("obra_id");

ALTER TABLE "compras_config" ADD CONSTRAINT "compras_config_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
