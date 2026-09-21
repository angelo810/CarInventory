import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusSelect } from "./status-select";
import { VehicleInventory, type InventoryRow } from "./vehicle-inventory";

export default async function VehiculoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [vehicle, catalog] = await Promise.all([
    prisma.sourceVehicle.findUnique({
      where: { id },
      include: {
        parts: { include: { partType: true, saleItems: true } },
        expenses: { orderBy: { date: "desc" } },
      },
    }),
    prisma.partType.findMany({
      where: { catalog: true, zone: { not: null } },
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  if (!vehicle) notFound();

  const additionalExpenses = vehicle.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCost = Number(vehicle.purchaseCost) + additionalExpenses;
  const recovered = vehicle.parts.reduce(
    (sum, p) => sum + p.saleItems.reduce((s, si) => s + Number(si.priceSold), 0),
    0,
  );
  const netProfit = recovered - totalCost;
  const soldCount = vehicle.parts.filter((p) => p.status === "SOLD").length;
  const availableCount = vehicle.parts.filter((p) => p.status === "AVAILABLE").length;

  // Una fila por tipo de pieza: las del catálogo (traiga o no el auto) + las propias de este vehículo
  const rows = new Map<string, InventoryRow>();
  for (const t of catalog) {
    rows.set(t.id, {
      partTypeId: t.id,
      name: t.name,
      zone: t.zone as InventoryRow["zone"],
      kept: t.kept,
      available: 0,
      sold: 0,
      other: 0,
      price: 0,
    });
  }
  for (const p of vehicle.parts) {
    let row = rows.get(p.partTypeId);
    if (!row) {
      row = {
        partTypeId: p.partTypeId,
        name: p.partType.name,
        zone: (p.partType.zone as InventoryRow["zone"]) ?? "OTHER",
        kept: true,
        available: 0,
        sold: 0,
        other: 0,
        price: 0,
      };
      rows.set(p.partTypeId, row);
    }
    if (p.status === "AVAILABLE") {
      row.available += 1;
      row.price = Number(p.price);
    } else if (p.status === "SOLD") row.sold += 1;
    else row.other += 1;
  }

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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Kpi label="Costo total" value={formatCurrency(totalCost)} />
        <Kpi label="Recuperado" value={formatCurrency(recovered)} />
        <Kpi
          label="Utilidad neta"
          value={formatCurrency(netProfit)}
          tone={netProfit >= 0 ? "positive" : "negative"}
        />
        <Kpi label="Disponibles" value={String(availableCount)} />
        <Kpi label="Vendidas" value={`${soldCount} / ${vehicle.parts.length}`} />
      </div>

      <VehicleInventory
        key={[...rows.values()].map((r) => `${r.partTypeId}:${r.available}:${r.sold}:${r.price}`).join("|")}
        vehicleId={vehicle.id}
        rows={[...rows.values()]}
      />

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
