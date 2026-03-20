-- CreateTable
CREATE TABLE "aprs" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "activity_name" VARCHAR(255) NOT NULL,
    "date" DATE NOT NULL,
    "responsible" VARCHAR(255) NOT NULL,
    "risks" JSONB NOT NULL DEFAULT '[]',
    "status" VARCHAR(50) NOT NULL DEFAULT 'rascunho',
    "created_by" UUID,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epi_controls" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "epi_name" VARCHAR(255) NOT NULL,
    "epi_type" VARCHAR(100) NOT NULL,
    "delivered_at" DATE NOT NULL,
    "expires_at" DATE,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "ca_number" VARCHAR(50),
    "returned_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "obra_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "severity" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "immediate_action" TEXT,
    "corrective_action" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "reported_by" UUID,
    "injured_user_id" UUID,
    "photo_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(50) NOT NULL DEFAULT 'aberto',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "obra_id" UUID,
    "training_name" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(255),
    "nr" VARCHAR(20) NOT NULL,
    "completed_at" DATE NOT NULL,
    "expires_at" DATE,
    "certificate_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aprs_obra_id_idx" ON "aprs"("obra_id");

-- CreateIndex
CREATE INDEX "epi_controls_obra_id_idx" ON "epi_controls"("obra_id");

-- CreateIndex
CREATE INDEX "epi_controls_user_id_idx" ON "epi_controls"("user_id");

-- CreateIndex
CREATE INDEX "incidents_obra_id_idx" ON "incidents"("obra_id");

-- CreateIndex
CREATE INDEX "trainings_user_id_idx" ON "trainings"("user_id");

-- CreateIndex
CREATE INDEX "trainings_obra_id_idx" ON "trainings"("obra_id");

-- AddForeignKey
ALTER TABLE "aprs" ADD CONSTRAINT "aprs_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprs" ADD CONSTRAINT "aprs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprs" ADD CONSTRAINT "aprs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_controls" ADD CONSTRAINT "epi_controls_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_controls" ADD CONSTRAINT "epi_controls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_injured_user_id_fkey" FOREIGN KEY ("injured_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
