-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Part_sku_trgm_idx" ON "Part" USING GIN ("sku" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "PartCompat_brand_trgm_idx" ON "PartCompatibility" USING GIN ("brand" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "PartCompat_model_trgm_idx" ON "PartCompatibility" USING GIN ("model" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "PartType_name_trgm_idx" ON "PartType" USING GIN ("name" gin_trgm_ops);
