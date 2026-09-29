-- Renombra columnas en vez de borrar y crear, para no perder los valores ya guardados.
ALTER TABLE "SourceVehicle" RENAME COLUMN "vin" TO "plate";
ALTER TABLE "SourceVehicle" RENAME COLUMN "engine" TO "color";
ALTER INDEX "SourceVehicle_vin_key" RENAME TO "SourceVehicle_plate_key";
