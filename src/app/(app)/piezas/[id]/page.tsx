import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { partStatusBadgeVariant, partStatusLabels } from "@/lib/labels";
import { PartEditForm } from "./part-edit-form";

export default async function PiezaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      partType: { include: { category: true, compatibilities: true } },
      sourceVehicle: true,
      priceHistory: { orderBy: { changedAt: "desc" } },
      saleItems: { include: { sale: { include: { customer: true } } } },
    },
  });

  if (!part) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{part.partType.name}</h1>
            <Badge variant="outline">{part.partType.category.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono">{part.sku}</p>
        </div>
        <Badge className="text-sm" variant={partStatusBadgeVariant[part.status]}>
          {partStatusLabels[part.status]}
        </Badge>
      </div>

      {part.partType.compatibilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compatibilidad</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {part.partType.compatibilities.map((c) => (
              <Badge key={c.id} variant="secondary">
                {c.brand} {c.model} {c.yearFrom}-{c.yearTo}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {part.sourceVehicle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehículo de origen</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/vehiculos/${part.sourceVehicle.id}`} className="hover:underline">
              {part.sourceVehicle.brand} {part.sourceVehicle.model} ({part.sourceVehicle.year})
            </Link>
          </CardContent>
        </Card>
      )}

      {part.saleItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {part.saleItems.map((si) => (
              <Link key={si.id} href={`/ventas/${si.saleId}`} className="block hover:underline">
                Vendida a {si.sale.customer?.name ?? "Cliente sin registrar"} por{" "}
                {formatCurrency(si.priceSold.toString())} el {formatDateTime(si.sale.saleDate)}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editar pieza</CardTitle>
          </CardHeader>
          <CardContent>
            <PartEditForm
              partId={part.id}
              condition={part.condition}
              status={part.status}
              location={part.location ?? ""}
              cost={part.cost.toString()}
              price={part.price.toString()}
              notes={part.notes ?? ""}
            />
          </CardContent>
        </Card>
      )}

      {part.priceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de precio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {part.priceHistory.map((h) => (
              <div key={h.id} className="flex justify-between text-muted-foreground">
                <span>{formatDateTime(h.changedAt)}</span>
                <span>
                  {formatCurrency(h.oldPrice.toString())} → {formatCurrency(h.newPrice.toString())}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
