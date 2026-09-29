-- CreateEnum
CREATE TYPE "Business" AS ENUM ('MONEYCARS', 'INNOMUNDO');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "business" "Business" NOT NULL DEFAULT 'MONEYCARS';

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "business" "Business" NOT NULL DEFAULT 'MONEYCARS';

-- AlterTable
ALTER TABLE "PartType" ADD COLUMN     "business" "Business" NOT NULL DEFAULT 'MONEYCARS';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "business" "Business" NOT NULL DEFAULT 'MONEYCARS';

-- AlterTable
ALTER TABLE "SourceVehicle" ADD COLUMN     "business" "Business" NOT NULL DEFAULT 'MONEYCARS';

-- CreateIndex
CREATE INDEX "Expense_business_idx" ON "Expense"("business");

-- CreateIndex
CREATE INDEX "Part_business_idx" ON "Part"("business");

-- CreateIndex
CREATE INDEX "PartType_business_idx" ON "PartType"("business");

-- CreateIndex
CREATE INDEX "Sale_business_idx" ON "Sale"("business");

-- CreateIndex
CREATE INDEX "SourceVehicle_business_idx" ON "SourceVehicle"("business");
