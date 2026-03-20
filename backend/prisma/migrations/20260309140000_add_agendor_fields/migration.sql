-- Add Agendor-specific fields to proposals
ALTER TABLE "proposals" ADD COLUMN "agendor_stage_name" VARCHAR(255);
ALTER TABLE "proposals" ADD COLUMN "agendor_funnel_name" VARCHAR(255);
ALTER TABLE "proposals" ADD COLUMN "agendor_web_url" VARCHAR(500);
ALTER TABLE "proposals" ADD COLUMN "agendor_updated_at" TIMESTAMP(3);

-- Add unique constraint on agendor_deal_id
CREATE UNIQUE INDEX "proposals_agendor_deal_id_key" ON "proposals"("agendor_deal_id");
