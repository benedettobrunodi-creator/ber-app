-- Bloco 4: NFs dos colaboradores PJ
ALTER TABLE "users" ADD COLUMN "is_pj" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "colaborador_nfs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "competencia" DATE NOT NULL,
  "numero" VARCHAR(60) NOT NULL,
  "valor_centavos" INTEGER NOT NULL,
  "arquivo_url" TEXT NOT NULL,
  "observacoes" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'enviada',
  "motivo_rejeicao" TEXT,
  "validada_por_id" UUID,
  "validada_em" TIMESTAMP(3),
  "paga_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "colaborador_nfs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "colaborador_nfs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "colaborador_nfs_validada_por_id_fkey" FOREIGN KEY ("validada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "colaborador_nfs_user_id_competencia_key" ON "colaborador_nfs"("user_id", "competencia");
