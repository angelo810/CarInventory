import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import {
  currentMonthPeriod,
  getFinancialSummary,
  getMonthlySales,
  getTopSellingParts,
  getVehicleProfitability,
  getVehicleSales,
} from "@/lib/finance";
import { ExpenseForm } from "./expense-form";
import { MonthlySalesChart } from "./monthly-sales-chart";

const ZONE_LABELS: Record<string, string> = {
  INTERIOR: "Interior",
  MECHANICAL: "Mecánico",
  EXTERIOR: "Exterior",
};

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function parseDay(value?: string, endOfDay = false) {
  if (!value) return undefined;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setHours(0, 0, 0, 0);
  if (endOfDay) d.setDate(d.getDate() + 1);
  return d;
}

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string; from?: string; to?: string }>;
}) {
  const { vehicleId, from, to } = await searchParams;
  const period = currentMonthPeriod();
  const range = { from: parseDay(from), to: parseDay(to, true) };

  const [summary, monthlySales, topParts, expenses, vehicles, profitability, vehicleSales] = await Promise.all([
    getFinancialSummary(period),
    getMonthlySales(6),
    getTopSellingParts(5),
    prisma.expense.findMany({ orderBy: { date: "desc" }, take: 20, include: { sourceVehicle: true } }),
    prisma.sourceVehicle.findMany({ orderBy: { purchaseDate: "desc" } }),
    getVehicleProfitability(range),
    vehicleId ? getVehicleSales(vehicleId, range) : Promise.resolve([]),
  ]);

  const shownRows = (vehicleId ? profitability.rows.filter((r) => r.id === vehicleId) : profitability.rows)
    .filter((r) => r.pieces > 0 || vehicleId)
    .sort((a, b) => b.revenue - a.revenue);
  const totals = shownRows.reduce(
    (t, r) => ({ pieces: t.pieces + r.pieces, revenue: t.revenue + r.revenue, cost: t.cost + r.cost, profit: t.profit + r.profit }),
    { pieces: 0, revenue: 0, cost: 0, profit: 0 },
  );
  const selected = vehicleId ? profitability.rows.find((r) => r.id === vehicleId) : undefined;
  const byZone = new Map<string, { count: number; revenue: number }>();
  for (const s of vehicleSales) {
    const key = s.zone ? ZONE_LABELS[s.zone] : "Otras";
    const z = byZone.get(key) ?? { count: 0, revenue: 0 };
    z.count += 1;
    z.revenue += s.price;
    byZone.set(key, z);
  }

  const filtersOn = Boolean(vehicleId || from || to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">Resumen del mes actual, rentabilidad por vehículo y gastos.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Ingresos (mes)" value={formatCurrency(summary.income)} />
        <Kpi label="Costos (vehículos + desmantelaje)" value={formatCurrency(summary.totalCosts)} />
        <Kpi label="Gastos operativos" value={formatCurrency(summary.operatingExpenses)} />
        <Kpi
          label="Utilidad neta"
          value={formatCurrency(summary.profit)}
          tone={summary.profit >= 0 ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rentabilidad por vehículo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Suma de todo lo vendido de las piezas de cada auto. El costo es la compra del vehículo más sus gastos (no
            depende del rango de fechas).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="GET" action="/finanzas" className="flex flex-wrap items-end gap-2">
            <select name="vehicleId" defaultValue={vehicleId ?? ""} className={selectClass}>
              <option value="">Todos los vehículos</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model}
                </option>
              ))}
            </select>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Desde
              <Input type="date" name="from" defaultValue={from ?? ""} className="h-8 w-40" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Hasta
              <Input type="date" name="to" defaultValue={to ?? ""} className="h-8 w-40" />
            </label>
            <Button type="submit">Filtrar</Button>
            {filtersOn && (
              <Button variant="ghost" render={<Link href="/finanzas" />} nativeButton={false}>
                Limpiar
              </Button>
            )}
          </form>

          {selected && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label={`Generó ${selected.name}`} value={formatCurrency(selected.revenue)} />
              <Kpi label="Piezas vendidas" value={String(selected.pieces)} />
              <Kpi label="Costo del vehículo" value={formatCurrency(selected.cost)} />
              <Kpi
                label="Ganancia"
                value={formatCurrency(selected.profit)}
                tone={selected.profit >= 0 ? "positive" : "negative"}
              />
              <Kpi
                label="Precio promedio"
                value={formatCurrency(selected.pieces ? selected.revenue / selected.pieces : 0)}
              />
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead className="text-right">Piezas vendidas</TableHead>
                  <TableHead className="text-right">Generó</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Ganancia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/finanzas?vehicleId=${r.id}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{r.pieces}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.cost)}</TableCell>
                    <TableCell className={`text-right ${r.profit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {formatCurrency(r.profit)}
                    </TableCell>
                  </TableRow>
                ))}
                {shownRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay ventas en ese filtro.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{totals.pieces}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totals.revenue)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totals.cost)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(totals.profit)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {!vehicleId && profitability.unassigned.pieces > 0 && (
            <p className="text-xs text-muted-foreground">
              Además hay {profitability.unassigned.pieces} piezas vendidas sin auto asignado por{" "}
              {formatCurrency(profitability.unassigned.revenue)} (chatarra y ventas sin vehículo), que no entran en la
              tabla.
            </p>
          )}

          {selected && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                {[...byZone.entries()].map(([zone, z]) => (
                  <span key={zone} className="rounded-md border px-2.5 py-1">
                    {zone}: <b>{z.count}</b> piezas · {formatCurrency(z.revenue)}
                  </span>
                ))}
              </div>
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Pieza</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleSales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(s.date)}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.zone ? ZONE_LABELS[s.zone] : "—"}</TableCell>
                        <TableCell>{s.employee ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por mes</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlySalesChart data={monthlySales} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Piezas más vendidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topParts.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4">{i + 1}.</span>
                    {p.name}
                    <span className="text-muted-foreground">({p.count} vendidas)</span>
                  </span>
                  <span className="font-medium">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
              {topParts.length === 0 && (
                <p className="text-sm text-muted-foreground">Aún no hay ventas registradas.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              vehicles={vehicles.map((v) => ({ id: v.id, brand: v.brand, model: v.model, year: v.year }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos gastos</CardTitle>
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
                {expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.date)}</TableCell>
                    <TableCell>
                      {e.description}
                      <div className="text-xs text-muted-foreground">
                        {expenseCategoryLabels[e.category]}
                        {e.sourceVehicle && ` · ${e.sourceVehicle.brand} ${e.sourceVehicle.model}`}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(e.amount.toString())}</TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                      No hay gastos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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
