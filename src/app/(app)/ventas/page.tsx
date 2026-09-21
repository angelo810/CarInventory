import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Pencil, Plus, Search } from "lucide-react";
import { DeleteSaleButton } from "./delete-sale-button";

const PAGE_SIZE = 50;

const ZONE_LABELS: Record<string, string> = {
  INTERIOR: "Interior",
  MECHANICAL: "Mecánico",
  EXTERIOR: "Exterior",
};

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Params = { q?: string; vehicleId?: string; employeeId?: string; page?: string; vista?: string };

export default async function VentasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { q, vehicleId, employeeId, page, vista } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const query = q?.trim();
  const byPiece = vista !== "ventas";

  const contains = (v: string) => ({ contains: v, mode: "insensitive" as const });

  // Filtro a nivel de venta
  const saleAnd: Prisma.SaleWhereInput[] = [];
  if (query) {
    saleAnd.push({
      OR: [
        { notes: contains(query) },
        { employee: { name: contains(query) } },
        {
          items: {
            some: {
              part: {
                OR: [
                  { sku: contains(query) },
                  { notes: contains(query) },
                  { partType: { name: contains(query) } },
                  { sourceVehicle: { OR: [{ brand: contains(query) }, { model: contains(query) }] } },
                ],
              },
            },
          },
        },
      ],
    });
  }
  if (vehicleId) saleAnd.push({ items: { some: { part: { sourceVehicleId: vehicleId } } } });
  if (employeeId) saleAnd.push({ employeeId });
  const saleWhere: Prisma.SaleWhereInput = saleAnd.length ? { AND: saleAnd } : {};

  // Filtro a nivel de pieza vendida
  const itemAnd: Prisma.SaleItemWhereInput[] = [];
  if (query) {
    itemAnd.push({
      OR: [
        { part: { sku: contains(query) } },
        { part: { notes: contains(query) } },
        { part: { partType: { name: contains(query) } } },
        { part: { sourceVehicle: { OR: [{ brand: contains(query) }, { model: contains(query) }] } } },
        { sale: { employee: { name: contains(query) } } },
        { sale: { notes: contains(query) } },
      ],
    });
  }
  if (vehicleId) itemAnd.push({ part: { sourceVehicleId: vehicleId } });
  if (employeeId) itemAnd.push({ sale: { employeeId } });
  const itemWhere: Prisma.SaleItemWhereInput = itemAnd.length ? { AND: itemAnd } : {};

  const [vehicles, employees] = await Promise.all([
    prisma.sourceVehicle.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }] }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
  ]);

  const skip = (currentPage - 1) * PAGE_SIZE;

  const pieceData = byPiece
    ? await Promise.all([
        prisma.saleItem.findMany({
          where: itemWhere,
          include: {
            part: { include: { partType: true, sourceVehicle: true } },
            sale: { include: { employee: true } },
          },
          orderBy: [{ sale: { saleDate: "desc" } }, { id: "asc" }],
          skip,
          take: PAGE_SIZE,
        }),
        prisma.saleItem.count({ where: itemWhere }),
        prisma.saleItem.aggregate({ where: itemWhere, _sum: { priceSold: true } }),
      ])
    : null;

  const saleData = !byPiece
    ? await Promise.all([
        prisma.sale.findMany({
          where: saleWhere,
          include: {
            employee: true,
            items: { include: { part: { include: { partType: true, sourceVehicle: true } } } },
          },
          orderBy: { saleDate: "desc" },
          skip,
          take: PAGE_SIZE,
        }),
        prisma.sale.count({ where: saleWhere }),
        prisma.sale.aggregate({ where: saleWhere, _sum: { totalAmount: true } }),
      ])
    : null;

  const total = byPiece ? pieceData![1] : saleData![1];
  const sum = Number(byPiece ? pieceData![2]._sum.priceSold ?? 0 : saleData![2]._sum.totalAmount ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(overrides: Partial<Params>) {
    const params = new URLSearchParams();
    const merged = { q: query, vehicleId, employeeId, vista, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/ventas?${s}` : "/ventas";
  }

  const hasFilters = Boolean(query || vehicleId || employeeId);
  const unit = byPiece ? "pieza" : "venta";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">
            {total} {unit}
            {total === 1 ? "" : "s"} · {formatCurrency(sum)}
            {hasFilters && " (con filtros)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={byPiece ? "default" : "ghost"}
              render={<Link href={href({ vista: undefined, page: undefined })} />}
              nativeButton={false}
            >
              Por piezas
            </Button>
            <Button
              size="sm"
              variant={!byPiece ? "default" : "ghost"}
              render={<Link href={href({ vista: "ventas", page: undefined })} />}
              nativeButton={false}
            >
              Por ventas
            </Button>
          </div>
          <Button variant="outline" render={<Link href="/ventas/revisar" />} nativeButton={false}>
            Revisar coincidencias
          </Button>
          <Button render={<Link href="/ventas/nueva" />} nativeButton={false}>
            <Plus className="size-4" />
            Nueva venta
          </Button>
        </div>
      </div>

      <form method="GET" action="/ventas" className="flex flex-wrap items-center gap-2">
        {vista === "ventas" && <input type="hidden" name="vista" value="ventas" />}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input key={query ?? ""} name="q" defaultValue={query ?? ""} placeholder="Buscar pieza, auto, empleado, SKU…" className="pl-8" />
        </div>
        <select name="vehicleId" defaultValue={vehicleId ?? ""} className={selectClass}>
          <option value="">Todos los autos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.brand} {v.model}
            </option>
          ))}
        </select>
        <select name="employeeId" defaultValue={employeeId ?? ""} className={selectClass}>
          <option value="">Todos los empleados</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <Button type="submit">Filtrar</Button>
        {hasFilters && (
          <Button variant="ghost" render={<Link href={href({ q: undefined, vehicleId: undefined, employeeId: undefined })} />} nativeButton={false}>
            Limpiar
          </Button>
        )}
      </form>

      <Card>
        <CardContent className="p-0">
          {byPiece ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20"></TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead>Pieza</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pieceData![0].map((i) => {
                  const review = i.part.notes?.includes("(revisar)");
                  const matched = Boolean(i.part.partType.catalog) || Boolean(i.part.notes?.includes("(asignada)"));
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="w-20 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Editar venta"
                          render={<Link href={`/ventas/${i.saleId}/editar`} />}
                          nativeButton={false}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <DeleteSaleButton
                          iconOnly
                          saleId={i.saleId}
                          summary={`${formatDateTime(i.sale.saleDate)} · ${i.part.partType.name} · ${formatCurrency(i.priceSold.toString())}. Se elimina la venta completa con todas sus piezas.`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/ventas/${i.saleId}`} className="hover:underline">
                          {formatDateTime(i.sale.saleDate)}
                        </Link>
                      </TableCell>
                      <TableCell>{i.sale.employee?.name ?? "—"}</TableCell>
                      <TableCell>
                        {i.part.sourceVehicle ? `${i.part.sourceVehicle.brand} ${i.part.sourceVehicle.model}` : "—"}
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        {i.part.partType.name}
                        {review && (
                          <Badge variant="outline" className="ml-2">
                            revisar
                          </Badge>
                        )}
                        {!matched && i.part.notes?.startsWith("Vendida como") && (
                          <Badge variant="secondary" className="ml-2">
                            sin coincidencia
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{i.part.partType.zone ? ZONE_LABELS[i.part.partType.zone] : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(i.priceSold.toString())}</TableCell>
                    </TableRow>
                  );
                })}
                {pieceData![0].length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No hay piezas vendidas que coincidan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20"></TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead>Pieza(s)</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saleData![0].map((s) => {
                  const vehicleNames = [
                    ...new Set(
                      s.items
                        .map((i) => i.part.sourceVehicle)
                        .filter((v): v is NonNullable<typeof v> => Boolean(v))
                        .map((v) => `${v.brand} ${v.model}`),
                    ),
                  ];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="w-20 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Editar venta"
                          render={<Link href={`/ventas/${s.id}/editar`} />}
                          nativeButton={false}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <DeleteSaleButton
                          iconOnly
                          saleId={s.id}
                          summary={`${formatDateTime(s.saleDate)} · ${s.items.map((i) => i.part.partType.name).join(" · ")} · ${formatCurrency(s.totalAmount.toString())}.`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/ventas/${s.id}`} className="hover:underline">
                          {formatDateTime(s.saleDate)}
                        </Link>
                      </TableCell>
                      <TableCell>{s.employee?.name ?? "—"}</TableCell>
                      <TableCell>{vehicleNames.join(", ") || "—"}</TableCell>
                      <TableCell className="max-w-md whitespace-normal">
                        {s.items.map((i) => i.part.partType.name).join(" · ")}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(s.totalAmount.toString())}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {saleData![0].length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No hay ventas que coincidan.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Button variant="outline" render={<Link href={href({ page: currentPage - 1 > 1 ? String(currentPage - 1) : undefined })} />} nativeButton={false}>
                Anterior
              </Button>
            )}
            {currentPage < totalPages && (
              <Button variant="outline" render={<Link href={href({ page: String(currentPage + 1) })} />} nativeButton={false}>
                Siguiente
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
