import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";
import { Button } from "@/components/ui/button";
import { AssignByPart, type PartCounts } from "./assign-by-part";

export default async function AsignarPorPiezaPage() {
  const business = await getActiveBusiness();

  const [types, vehicles, grouped] = await Promise.all([
    prisma.partType.findMany({
      where: { business, catalog: true, zone: { not: null } },
      orderBy: [{ zone: "asc" }, { name: "asc" }],
      select: { id: true, name: true, zone: true, imageUrl: true, category: { select: { name: true } } },
    }),
    prisma.sourceVehicle.findMany({
      where: { business },
      orderBy: { purchaseDate: "desc" },
      select: { id: true, brand: true, model: true, year: true, color: true },
    }),
    prisma.part.groupBy({
      by: ["partTypeId", "sourceVehicleId", "status"],
      where: { business, sourceVehicleId: { not: null }, partType: { catalog: true } },
      _count: { _all: true },
    }),
  ]);

  // partTypeId -> vehicleId -> unidades disponibles / vendidas / otras
  const counts: PartCounts = {};
  for (const g of grouped) {
    if (!g.sourceVehicleId) continue;
    const byVehicle = (counts[g.partTypeId] ??= {});
    const c = (byVehicle[g.sourceVehicleId] ??= { available: 0, sold: 0, other: 0 });
    if (g.status === "AVAILABLE") c.available += g._count._all;
    else if (g.status === "SOLD") c.sold += g._count._all;
    else c.other += g._count._all;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Asignar por pieza</h1>
          <p className="text-sm text-muted-foreground">
            Elige una pieza (por ejemplo, Alternador) y llena de una vez cuántas trae cada vehículo y en qué estado. Para
            hacerlo vehículo por vehículo, entra al vehículo y usa su inventario.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/vehiculos" />} nativeButton={false}>
          Volver a vehículos
        </Button>
      </div>
      <AssignByPart
        partTypes={types.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category.name,
          zone: t.zone as "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE",
          imageUrl: t.imageUrl,
        }))}
        vehicles={vehicles.map((v) => ({
          id: v.id,
          label: `${v.brand} ${v.model}${v.color ? ` ${v.color}` : ""} (${v.year})`,
        }))}
        counts={counts}
      />
    </div>
  );
}
