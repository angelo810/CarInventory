import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { currentMonthPeriod, getFinancialSummary } from "@/lib/finance";
import { Search, Plus, AlertTriangle } from "lucide-react";

const STALE_DAYS = 90;

export default async function DashboardPage() {
  const period = currentMonthPeriod();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  const [availableCount, salesToday, salesMonth, summary, staleParts] = await Promise.all([
    prisma.part.count({ where: { status: "AVAILABLE" } }),
    prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { saleDate: { gte: startOfToday } } }),
    prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { saleDate: { gte: period.from, lt: period.to } } }),
    getFinancialSummary(period),
    prisma.part.findMany({
      where: { status: "AVAILABLE", createdAt: { lt: staleDate } },
      include: { partType: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-sm text-muted-foreground">Resumen general del negocio.</p>
      </div>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-6">
          <p className="mb-3 font-medium">¿Tienen esta pieza?</p>
          <Button
            render={<Link href="/buscar" />} nativeButton={false}
            size="lg"
            variant="secondary"
            className="w-full justify-start sm:w-auto"
          >
            <Search className="size-5" />
            Ir al buscador de piezas
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Piezas disponibles" value={availableCount.toString()} />
        <Kpi label="Ventas hoy" value={`${salesToday._count} · ${formatCurrency(Number(salesToday._sum.totalAmount ?? 0))}`} />
        <Kpi label="Ventas del mes" value={`${salesMonth._count} · ${formatCurrency(Number(salesMonth._sum.totalAmount ?? 0))}`} />
        <Kpi
          label="Utilidad del mes"
          value={formatCurrency(summary.profit)}
          tone={summary.profit >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/ventas/nueva" />} nativeButton={false} variant="outline">
          <Plus className="size-4" />
          Registrar venta
        </Button>
        <Button render={<Link href="/piezas/nuevo" />} nativeButton={false} variant="outline">
          <Plus className="size-4" />
          Registrar pieza
        </Button>
        <Button render={<Link href="/vehiculos/nuevo" />} nativeButton={false} variant="outline">
          <Plus className="size-4" />
          Registrar vehículo
        </Button>
      </div>

      {staleParts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Piezas con mucho tiempo sin venderse (+{STALE_DAYS} días)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {staleParts.map((p) => (
              <Link
                key={p.id}
                href={`/piezas/${p.id}`}
                className="flex items-center justify-between text-sm hover:bg-accent/50 -mx-2 px-2 py-1 rounded-md"
              >
                <span>
                  {p.partType.name} <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                </span>
                <Badge variant="outline">Desde {formatDate(p.createdAt)}</Badge>
              </Link>
            ))}
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
          className={`text-xl font-semibold ${
            tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
