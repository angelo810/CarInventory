import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { partConditionLabels, partStatusBadgeVariant, partStatusLabels } from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function PiezasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const parts = await prisma.part.findMany({
    where: status && status !== "ALL" ? { status: status as never } : undefined,
    include: { partType: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const statusFilters = [
    { value: "ALL", label: "Todas" },
    { value: "AVAILABLE", label: "Disponibles" },
    { value: "RESERVED", label: "Reservadas" },
    { value: "SOLD", label: "Vendidas" },
    { value: "IN_REVIEW", label: "En revisión" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Piezas</h1>
          <p className="text-sm text-muted-foreground">Catálogo e inventario de piezas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/piezas/tipos" />} nativeButton={false}>
            Organizar tipos
          </Button>
          <Button render={<Link href="/piezas/nuevo" />} nativeButton={false}>
            <Plus className="size-4" />
            Nueva pieza
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <Button
            key={f.value}
            render={<Link href={f.value === "ALL" ? "/piezas" : `/piezas?status=${f.value}`} />}
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
                  <TableCell>{partConditionLabels[p.condition]}</TableCell>
                  <TableCell>{formatCurrency(p.price.toString())}</TableCell>
                  <TableCell>
                    <Badge variant={partStatusBadgeVariant[p.status]}>{partStatusLabels[p.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {parts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No hay piezas registradas todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
