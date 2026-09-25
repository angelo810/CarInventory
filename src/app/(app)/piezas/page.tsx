import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { partConditionLabels, partStatusBadgeVariant, partStatusLabels } from "@/lib/labels";
import { Plus, Search } from "lucide-react";

const PAGE_SIZE = 50;

const ZONE_FILTERS = [
  { value: "ALL", label: "Todas las zonas" },
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "DOCUMENTS", label: "Documentos" },
  { value: "SCRAP", label: "Chatarra" },
  { value: "COMPLETE", label: "Completo" },
  { value: "OTHER", label: "Otras" },
] as const;

const STATUS_FILTERS = [
  { value: "ALL", label: "Todas" },
  { value: "AVAILABLE", label: "Disponibles" },
  { value: "RESERVED", label: "Reservadas" },
  { value: "SOLD", label: "Vendidas" },
  { value: "IN_REVIEW", label: "En revisión" },
];

type Params = { status?: string; zone?: string; q?: string; page?: string };

export default async function PiezasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { status, zone, q, page } = await searchParams;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const currentPage = Math.max(1, Number(page) || 1);
  const query = q?.trim();

  const and: Prisma.PartWhereInput[] = [];
  if (status && status !== "ALL") and.push({ status: status as never });
  if (zone && zone !== "ALL") {
    and.push(
      zone === "OTHER"
        ? { partType: { catalog: false } }
        : { partType: { catalog: true, zone: zone as never } },
    );
  }
  if (query) {
    and.push({
      OR: [
        { sku: { contains: query, mode: "insensitive" } },
        { partType: { name: { contains: query, mode: "insensitive" } } },
        { sourceVehicle: { OR: [{ brand: { contains: query, mode: "insensitive" } }, { model: { contains: query, mode: "insensitive" } }] } },
      ],
    });
  }
  const where: Prisma.PartWhereInput = and.length ? { AND: and } : {};

  const [parts, total] = await Promise.all([
    prisma.part.findMany({
      where,
      include: { partType: { include: { category: true } }, sourceVehicle: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.part.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function href(overrides: Partial<Params>) {
    const merged = { status, zone, q: query, ...overrides };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/piezas?${s}` : "/piezas";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Piezas</h1>
          <p className="text-sm text-muted-foreground">
            {total} pieza{total === 1 ? "" : "s"} · Catálogo e inventario.
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/piezas/tipos" />} nativeButton={false}>
              Organizar tipos
            </Button>
            <Button render={<Link href="/piezas/nuevo" />} nativeButton={false}>
              <Plus className="size-4" />
              Nueva pieza
            </Button>
          </div>
        )}
      </div>

      <form method="GET" action="/piezas" className="flex flex-wrap items-center gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        {zone && <input type="hidden" name="zone" value={zone} />}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input key={query ?? ""} name="q" defaultValue={query ?? ""} placeholder="Buscar pieza, SKU o auto…" className="pl-8" />
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {ZONE_FILTERS.map((f) => (
          <Button
            key={f.value}
            render={<Link href={href({ zone: f.value === "ALL" ? undefined : f.value, page: undefined })} />}
            nativeButton={false}
            size="sm"
            variant={(zone ?? "ALL") === f.value ? "default" : "outline"}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            render={<Link href={href({ status: f.value === "ALL" ? undefined : f.value, page: undefined })} />}
            nativeButton={false}
            size="sm"
            variant={(status ?? "ALL") === f.value ? "default" : "outline"}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Pieza</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Auto</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/piezas/${p.id}`} className="font-mono text-xs hover:underline">
                      {p.sku}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/piezas/${p.id}`} className="font-medium hover:underline">
                      {p.partType.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.partType.category.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.sourceVehicle ? `${p.sourceVehicle.brand} ${p.sourceVehicle.model}` : "—"}
                  </TableCell>
                  <TableCell>{partConditionLabels[p.condition]}</TableCell>
                  <TableCell>{formatCurrency(p.price.toString())}</TableCell>
                  <TableCell>
                    <Badge variant={partStatusBadgeVariant[p.status]}>{partStatusLabels[p.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {parts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No hay piezas que coincidan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            render={<Link href={href({ page: String(currentPage - 1) })} />}
            nativeButton={false}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            render={<Link href={href({ page: String(currentPage + 1) })} />}
            nativeButton={false}
          >
            Siguiente
          </Button>
          <form method="GET" action="/piezas" className="flex items-center gap-1.5">
            {status && <input type="hidden" name="status" value={status} />}
            {zone && <input type="hidden" name="zone" value={zone} />}
            {query && <input type="hidden" name="q" value={query} />}
            <span className="text-sm text-muted-foreground">Ir a</span>
            <Input
              key={currentPage}
              type="number"
              name="page"
              min={1}
              max={totalPages}
              defaultValue={currentPage}
              className="h-8 w-16 text-center"
            />
            <Button type="submit" size="sm" variant="outline">
              Ir
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
