import { prisma } from "@/lib/prisma";
import { PartForm } from "./part-form";

export default async function NuevaPiezaPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;

  const [partTypes, categories, vehicles] = await Promise.all([
    prisma.partType.findMany({
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.sourceVehicle.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { purchaseDate: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva pieza</h1>
        <p className="text-sm text-muted-foreground">
          Registra una unidad de pieza, ya sea de un tipo existente o uno nuevo.
        </p>
      </div>
      <PartForm
        partTypes={partTypes.map((pt) => ({ id: pt.id, name: pt.name, category: pt.category.name }))}
        categories={categories}
        vehicles={vehicles.map((v) => ({ id: v.id, brand: v.brand, model: v.model, year: v.year }))}
        defaultVehicleId={vehicleId}
      />
    </div>
  );
}
