import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { currentMonthPeriod, getFinancialSummary, getMonthlySales, getTopSellingParts } from "@/lib/finance";
import { ExpenseForm } from "./expense-form";
import { MonthlySalesChart } from "./monthly-sales-chart";

export default async function FinanzasPage() {
  const period = currentMonthPeriod();

  const [summary, monthlySales, topParts, expenses, vehicles] = await Promise.all([
    getFinancialSummary(period),
    getMonthlySales(6),
    getTopSellingParts(5),
    prisma.expense.findMany({ orderBy: { date: "desc" }, take: 20, include: { sourceVehicle: true } }),
    prisma.sourceVehicle.findMany({ orderBy: { purchaseDate: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">Resumen del mes actual y gastos registrados.</p>
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
                <div key={p.name} className="flex items-center justify-between text-sm">
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
