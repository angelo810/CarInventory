-- CreateTable
CREATE TABLE "VehiclePartExclusion" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "partTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehiclePartExclusion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehiclePartExclusion_partTypeId_idx" ON "VehiclePartExclusion"("partTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "VehiclePartExclusion_vehicleId_partTypeId_key" ON "VehiclePartExclusion"("vehicleId", "partTypeId");

-- AddForeignKey
ALTER TABLE "VehiclePartExclusion" ADD CONSTRAINT "VehiclePartExclusion_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "SourceVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehiclePartExclusion" ADD CONSTRAINT "VehiclePartExclusion_partTypeId_fkey" FOREIGN KEY ("partTypeId") REFERENCES "PartType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
