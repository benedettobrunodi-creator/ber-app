-- Manual do Proprietário digital (03/09/26): preenchimento no sistema,
-- PDF gerado na identidade BÈR (modelo BER_Manual_ObraPoatek_v3).
CREATE TABLE "manual_proprietario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "foto_capa_url" TEXT,
    "data_entrega" DATE,
    "url_online" VARCHAR(300),
    "canal_assistencia" VARCHAR(300),
    "texto_bem_vindos" TEXT,
    "materiais" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "galeria" JSONB NOT NULL DEFAULT '[]',
    "acabamentos" JSONB NOT NULL DEFAULT '[]',
    "mobiliario" JSONB NOT NULL DEFAULT '[]',
    "fornecedores" JSONB NOT NULL DEFAULT '[]',
    "equipe" JSONB NOT NULL DEFAULT '[]',
    "anexos" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manual_proprietario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manual_proprietario_obra_id_key" ON "manual_proprietario"("obra_id");

ALTER TABLE "manual_proprietario" ADD CONSTRAINT "manual_proprietario_obra_id_fkey"
    FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
