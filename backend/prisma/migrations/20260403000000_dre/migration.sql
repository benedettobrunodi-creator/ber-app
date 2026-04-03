-- CreateTable
CREATE TABLE "dre_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "row_key" VARCHAR(20) NOT NULL,
    "col_key" VARCHAR(20) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kpi" DOUBLE PRECISION,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dre_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dre_values_row_key_col_key_key" ON "dre_values"("row_key", "col_key");

-- AddForeignKey
ALTER TABLE "dre_values" ADD CONSTRAINT "dre_values_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
