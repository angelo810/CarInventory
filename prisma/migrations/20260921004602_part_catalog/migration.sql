-- CreateEnum
CREATE TYPE "PartZone" AS ENUM ('INTERIOR', 'MECHANICAL', 'EXTERIOR');

-- AlterTable
ALTER TABLE "PartType" ADD COLUMN     "catalog" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kept" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "zone" "PartZone";

-- CreateIndex
CREATE INDEX "PartType_catalog_zone_idx" ON "PartType"("catalog", "zone");
