-- Auditoria de exclusões do Controle de Documentos (03/09/26).
-- Exclusão liberada pra campo+ mediante assinatura; este log é o rastro.
CREATE TABLE "documento_exclusao_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "obra_id" UUID NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "codigo" VARCHAR(150) NOT NULL,
    "detalhe" TEXT,
    "assinatura" VARCHAR(150) NOT NULL,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_exclusao_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "documento_exclusao_logs_obra_id_idx" ON "documento_exclusao_logs"("obra_id");
