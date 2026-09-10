CREATE TABLE "obra_kickoff_externos" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "conteudo" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obra_kickoff_externos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "obra_kickoff_externos_obra_id_key" ON "obra_kickoff_externos"("obra_id");
ALTER TABLE "obra_kickoff_externos" ADD CONSTRAINT "obra_kickoff_externos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
