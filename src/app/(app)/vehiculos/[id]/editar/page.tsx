import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VehicleEditForm } from "./vehicle-edit-form";

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function EditarVehiculoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await prisma.sourceVehicle.findUnique({ where: { id } });
  if (!vehicle) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Editar {vehicle.brand} {vehicle.model}
        </h1>
        <p className="text-sm text-muted-foreground">
          Corrige fechas, costo y datos del vehículo. Las piezas y ventas del vehículo no cambian.
        </p>
      </div>
      <VehicleEditForm
        vehicleId={vehicle.id}
        defaults={{
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color ?? "",
          plate: vehicle.plate ?? "",
          condition: vehicle.condition ?? "",
          purchaseDate: toDateInput(vehicle.purchaseDate),
          purchaseCost: vehicle.purchaseCost.toString(),
          notes: vehicle.notes ?? "",
        }}
      />
    </div>
  );
}
