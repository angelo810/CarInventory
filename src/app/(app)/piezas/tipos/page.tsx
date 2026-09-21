import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { TypesManager } from "./types-manager";

export default async function TiposPage() {
  const types = await prisma.partType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, zone: true, catalog: true, _count: { select: { parts: true } } },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizar tipos de pieza</h1>
          <p className="text-sm text-muted-foreground">
            Mueve las piezas de &quot;Otras&quot; a Interior, Mecánico o Exterior. Al moverlas aparecen en la lista al
            registrar vehículos y ventas.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/piezas" />} nativeButton={false}>
          Volver a piezas
        </Button>
      </div>
      <TypesManager
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          zone: t.catalog && t.zone ? t.zone : "OTHER",
          count: t._count.parts,
        }))}
      />
    </div>
  );
}
