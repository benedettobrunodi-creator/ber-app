-- CreateTable
CREATE TABLE "normas_tecnicas" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "discipline" VARCHAR(50) NOT NULL,
    "summary" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'interno',
    "url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "normas_tecnicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "normas_tecnicas_code_key" ON "normas_tecnicas"("code");

-- CreateIndex
CREATE INDEX "normas_tecnicas_discipline_idx" ON "normas_tecnicas"("discipline");
