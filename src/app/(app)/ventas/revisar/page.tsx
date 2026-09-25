import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CatalogProvider } from "./assign-row";
import { GroupsTable } from "./groups-table";
import { ConfirmAllButton } from "./confirm-all-button";

const SOLD_AS = "Vendida como: ";
const FLAGS = /( \((lado no especificado|revisar|asignada)\))+$/;

type Group = { text: string; count: number; revenue: number; vehicles: Set<string>; current?: string };

export default async function RevisarPage() {
  const [parts, catalog] = await Promise.all([
    prisma.part.findMany({
      where: { status: "SOLD", notes: { startsWith: SOLD_AS } },
      include: { partType: true, sourceVehicle: true, saleItems: true },
    }),
    prisma.partType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true, zone: true, catalog: true } }),
  ]);

  const unmatched = new Map<string, Group>();
  const review = new Map<string, Group>();

  for (const p of parts) {
    const text = (p.notes ?? "").slice(SOLD_AS.length).replace(FLAGS, "");
    if (/^\s*(chatarras?|completo)\b/i.test(text)) continue;
    const target = !p.partType.catalog && !p.notes?.includes("(asignada)") ? unmatched : p.notes?.includes("(revisar)") ? review : null;
    if (!target) continue;
    const key = target === review ? `${text}||${p.partType.name}` : text;
    const g = target.get(key) ?? { text, count: 0, revenue: 0, vehicles: new Set<string>(), current: p.partType.name };
    g.count += 1;
    g.revenue += Number(p.saleItems[0]?.priceSold ?? 0);
    if (p.sourceVehicle) g.vehicles.add(`${p.sourceVehicle.brand} ${p.sourceVehicle.model}`);
    target.set(key, g);
  }

  const unmatchedList = [...unmatched.values()].sort((a, b) => b.count - a.count);
  const reviewList = [...review.values()].sort((a, b) => b.count - a.count);
  const unmatchedPieces = unmatchedList.reduce((s, g) => s + g.count, 0);

  return (
    <CatalogProvider options={catalog.map((c) => ({ name: c.name, zone: c.catalog && c.zone ? c.zone : "OTHER" }))}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revisar coincidencias</h1>
          <p className="text-sm text-muted-foreground">
            Piezas vendidas que no se pudieron hacer coincidir con el catálogo, o que coincidieron con poca seguridad.
            Elige la pieza correcta y se asigna a todas las ventas con ese mismo texto.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/ventas" />} nativeButton={false}>
          Volver a ventas
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sin coincidencia ({unmatchedList.length} textos · {unmatchedPieces} piezas)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lo que dice el chat y no existe en tus listas de modelos (por ejemplo sockets, botón de stop). Si son piezas
            que tu lista no tiene, se pueden agregar a la lista al registrar un vehículo con &quot;Agregar a la lista&quot;.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <GroupsTable
            kind="unmatched"
            groups={unmatchedList.map((g) => ({ ...g, vehicles: [...g.vehicles] }))}
            emptyMessage="No hay piezas sin coincidencia."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Coincidencias por confirmar ({reviewList.length})</CardTitle>
            <p className="text-sm text-muted-foreground">
              El sistema propuso una pieza del catálogo pero con poca seguridad. Corrígela o confírmala.
            </p>
          </div>
          <ConfirmAllButton count={reviewList.length} />
        </CardHeader>
        <CardContent className="p-0">
          <GroupsTable
            kind="review"
            groups={reviewList.map((g) => ({ ...g, vehicles: [...g.vehicles] }))}
            emptyMessage="No hay coincidencias por confirmar."
          />
        </CardContent>
      </Card>
    </div>
    </CatalogProvider>
  );
}
