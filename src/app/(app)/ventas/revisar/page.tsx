import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { AssignRow, CatalogProvider } from "./assign-row";

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Texto del chat</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Autos</TableHead>
                <TableHead>Asignar a</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmatchedList.map((g) => (
                <TableRow key={g.text}>
                  <TableCell className="max-w-xs whitespace-normal">{g.text}</TableCell>
                  <TableCell className="text-right">{g.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(g.revenue)}</TableCell>
                  <TableCell className="max-w-48 whitespace-normal text-xs text-muted-foreground">
                    {[...g.vehicles].slice(0, 3).join(", ")}
                  </TableCell>
                  <TableCell>
                    <AssignRow text={g.text} kind="unmatched" />
                  </TableCell>
                </TableRow>
              ))}
              {unmatchedList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay piezas sin coincidencia.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coincidencias por confirmar ({reviewList.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            El sistema propuso una pieza del catálogo pero con poca seguridad. Corrígela o confírmala.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Texto del chat</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Asignada a</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewList.map((g) => (
                <TableRow key={`${g.text}${g.current}`}>
                  <TableCell className="max-w-xs whitespace-normal">{g.text}</TableCell>
                  <TableCell className="text-right">{g.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(g.revenue)}</TableCell>
                  <TableCell>
                    <AssignRow text={g.text} kind="review" initial={g.current} />
                  </TableCell>
                </TableRow>
              ))}
              {reviewList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No hay coincidencias por confirmar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </CatalogProvider>
  );
}
