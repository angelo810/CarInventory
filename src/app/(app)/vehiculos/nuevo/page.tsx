import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";
import { VehicleForm } from "../vehicle-form";

export default async function NuevoVehiculoPage() {
  const business = await getActiveBusiness();
  const existingVehicles = await prisma.sourceVehicle.findMany({
    where: { business },
    select: { brand: true, model: true },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo vehículo</h1>
        <p className="text-sm text-muted-foreground">
          Paso 1: registra los datos del vehículo. Al guardar, en el paso 2 le asignas las piezas que trae.
        </p>
      </div>
      <VehicleForm existingVehicles={existingVehicles} />
    </div>
  );
}
