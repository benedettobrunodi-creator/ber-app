-- Fechamento mensal de folha por centro de custo
CREATE TABLE "folha_fechamentos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "competencia" DATE NOT NULL,
  "status" VARCHAR(15) NOT NULL DEFAULT 'fechado',
  "fechado_por_id" UUID,
  "fechado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reaberto_por_id" UUID,
  "reaberto_em" TIMESTAMP(3),
  "observacoes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "folha_fechamentos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "folha_fechamentos_fechado_por_id_fkey" FOREIGN KEY ("fechado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "folha_fechamentos_reaberto_por_id_fkey" FOREIGN KEY ("reaberto_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "folha_fechamentos_competencia_key" ON "folha_fechamentos"("competencia");

CREATE TABLE "folha_fechamento_linhas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fechamento_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "obra_id" UUID,
  "minutos" INTEGER NOT NULL,
  "minutos_extras" INTEGER NOT NULL DEFAULT 0,
  "detalhe" TEXT,
  CONSTRAINT "folha_fechamento_linhas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "folha_fechamento_linhas_fechamento_id_fkey" FOREIGN KEY ("fechamento_id") REFERENCES "folha_fechamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "folha_fechamento_linhas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "folha_fechamento_linhas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "folha_fechamento_linhas_fechamento_id_idx" ON "folha_fechamento_linhas"("fechamento_id");
