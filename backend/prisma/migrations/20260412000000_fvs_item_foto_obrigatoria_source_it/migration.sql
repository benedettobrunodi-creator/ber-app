-- Add foto_obrigatoria and source_it_code to fvs_template_items
ALTER TABLE "fvs_template_items"
  ADD COLUMN "foto_obrigatoria" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "source_it_code" VARCHAR(20);

CREATE INDEX "fvs_template_items_source_it_code_idx" ON "fvs_template_items"("source_it_code");
