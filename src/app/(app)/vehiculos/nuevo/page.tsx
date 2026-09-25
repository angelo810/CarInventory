import { prisma } from "@/lib/prisma";
import { VehicleForm } from "../vehicle-form";

export default async function NuevoVehiculoPage() {
  const catalog = await prisma.partType.findMany({
    where: { catalog: true, zone: { not: null } },
    orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, zone: true, kept: true },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo vehículo</h1>
        <p className="text-sm text-muted-foreground">
          Registra el vehículo y marca qué piezas trae, cuántas de cada una. Se crean solas en el inventario.
        </p>
      </div>
      <VehicleForm
        catalog={catalog.map((c) => ({
          id: c.id,
          name: c.name,
          zone: c.zone as "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE",
          kept: c.kept,
        }))}
      />
    </div>
  );
}
