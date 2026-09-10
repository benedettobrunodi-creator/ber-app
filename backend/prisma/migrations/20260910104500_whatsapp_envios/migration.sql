CREATE TABLE "whatsapp_envios" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "relatorio_id" UUID NOT NULL,
    "destinatario" VARCHAR(150) NOT NULL,
    "telefone" VARCHAR(30) NOT NULL,
    "legenda" TEXT NOT NULL,
    "arquivo_path" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "enviado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_envios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "whatsapp_envios_status_idx" ON "whatsapp_envios"("status");
