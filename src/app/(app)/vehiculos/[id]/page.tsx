import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { partConditionLabels, partStatusBadgeVariant, partStatusLabels, sourceVehicleStatusLabels } from "@/lib/labels";
import { StatusSelect } from "./status-select";

export default async function VehiculoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vehicle = await prisma.sourceVehicle.findUnique({
    where: { id },
    include: {
      parts: {
        include: { partType: true, saleItems: true },
        orderBy: { createdAt: "desc" },
      },
      expenses: { orderBy: { date: "desc" } },
    },
  });

  if (!vehicle) notFound();

  const additionalExpenses = vehicle.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCost = Number(vehicle.purchaseCost) + additionalExpenses;
  const recovered = vehicle.parts.reduce(
    (sum, p) => sum + p.saleItems.reduce((s, si) => s + Number(si.priceSold), 0),
    0,
  );
  const netProfit = recovered - totalCost;
  const soldCount = vehicle.parts.filter((p) => p.status === "SOLD").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {vehicle.brand} {vehicle.model} ({vehicle.year})
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprado el {formatDate(vehicle.purchaseDate)}
            {vehicle.vin && ` · VIN: ${vehicle.vin}`}
          </p>
        </div>
        <StatusSelect vehicleId={vehicle.id} status={vehicle.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Costo total" value={formatCurrency(totalCost)} />
        <Kpi label="Recuperado" value={formatCurrency(recovered)} />
        <Kpi
          label="Utilidad neta"
          value={formatCurrency(netProfit)}
          tone={netProfit >= 0 ? "positive" : "negative"}
        />
        <Kpi label="Piezas vendidas" value={`${soldCount} / ${vehicle.parts.length}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Piezas extraídas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Pieza</TableHead>
                <TableHead>Condición</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.parts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/piezas/${p.id}`} className="font-mono text-xs hover:underline">
                      {p.sku}
                    </Link>
                  </TableCell>
                  <TableCell>{p.partType.name}</TableCell>
                  <TableCell>{partConditionLabels[p.condition]}</TableCell>
                  <TableCell>{formatCurrency(p.cost.toString())}</TableCell>
                  <TableCell>{formatCurrency(p.price.toString())}</TableCell>
                  <TableCell>
                    <Badge variant={partStatusBadgeVariant[p.status]}>{partStatusLabels[p.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {vehicle.parts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Aún no se han registrado piezas de este vehículo.
                    <div className="mt-2">
                      <Button
                        render={<Link href={`/piezas/nuevo?vehicleId=${vehicle.id}`} />}
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                      >
                        Registrar pieza
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {vehicle.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gastos asociados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.date)}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>{formatCurrency(e.amount.toString())}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-semibold ${
            tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
