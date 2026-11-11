import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  ListChecks,
  PackagePlus,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Boxes,
  Receipt,
  CalendarDays,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";
import { BUSINESS_LABELS } from "@/lib/business-shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { currentMonthPeriod, getFinancialSummary } from "@/lib/finance";

const STALE_DAYS = 90;

const ACTIONS = [
  { href: "/ventas/nueva", label: "Registrar venta", hint: "Anota lo que se vendió", icon: ShoppingCart, tone: "emerald" },
  { href: "/vehiculos/nuevo", label: "Registrar vehículo", hint: "Un auto nuevo para desarmar", icon: Car, tone: "sky" },
  { href: "/piezas/nuevo", label: "Registrar pieza", hint: "Una pieza suelta al inventario", icon: PackagePlus, tone: "violet" },
  { href: "/vehiculos/por-pieza", label: "Asignar por pieza", hint: "Llena una pieza en varios autos", icon: ListChecks, tone: "amber" },
] as const;

const TONES: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function dateParam(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function DashboardPage() {
  const period = currentMonthPeriod();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);
  const business = await getActiveBusiness();

  const [availableCount, salesToday, salesMonth, summary, staleParts, recentSales, recentVehicles] = await Promise.all([
    prisma.part.count({ where: { business, status: "AVAILABLE" } }),
    prisma.sale.aggregate({ _sum: { totalAmount: true }, _count: true, where: { business, saleDate: { gte: startOfToday } } }),
    prisma.sale.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { business, saleDate: { gte: period.from, lt: period.to } },
    }),
    getFinancialSummary(period, business),
    prisma.part.findMany({
      where: { business, status: "AVAILABLE", createdAt: { lt: staleDate } },
      include: { partType: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.sale.findMany({
      where: { business },
      orderBy: { saleDate: "desc" },
      take: 5,
      include: { employee: true, items: { include: { part: { include: { partType: true } } } } },
    }),
    prisma.sourceVehicle.findMany({
      where: { business },
      orderBy: { purchaseDate: "desc" },
      take: 5,
      select: { id: true, brand: true, model: true, year: true, color: true, purchaseDate: true, _count: { select: { parts: true } } },
    }),
  ]);

  // piezas disponibles por vehículo reciente
  const availableByVehicle = await prisma.part.groupBy({
    by: ["sourceVehicleId"],
    where: { business, status: "AVAILABLE", sourceVehicleId: { in: recentVehicles.map((v) => v.id) } },
    _count: { _all: true },
  });
  const availableMap = new Map(availableByVehicle.map((g) => [g.sourceVehicleId, g._count._all]));

  const monthFrom = dateParam(period.from);
  const monthTo = dateParam(new Date(period.to.getTime() - 86400000));
  const todayRaw = new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Panel</h1>
          <p className="text-base text-muted-foreground">
            {BUSINESS_LABELS[business]} · {today}
          </p>
        </div>
      </div>

      {/* Buscador */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold md:text-3xl">¿Tienen esta pieza?</h2>
        <p className="mt-1 text-base opacity-80">Escribe el nombre, el auto o el SKU y mira al instante si está disponible.</p>
        <form action="/buscar" method="GET" className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              autoComplete="off"
              placeholder="Ej: alternador corolla, faro delantero, MOT-000123…"
              className="h-14 w-full rounded-xl border-0 bg-background pl-12 pr-4 text-lg text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-white/40"
            />
          </div>
          <Button type="submit" size="lg" variant="secondary" className="h-14 rounded-xl px-8 text-lg">
            Buscar
          </Button>
        </form>
      </section>

      {/* Acciones rápidas */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">¿Qué quieres hacer?</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
            >
              <span className={`flex size-14 items-center justify-center rounded-2xl ${TONES[a.tone]}`}>
                <a.icon className="size-7" />
              </span>
              <span>
                <span className="block text-lg font-semibold leading-tight">{a.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{a.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Cifras */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          href="/piezas?status=AVAILABLE"
          icon={Boxes}
          tone="sky"
          label="Piezas disponibles"
          value={availableCount.toLocaleString("es-EC")}
          hint="Ver inventario"
        />
        <Stat
          href="/ventas"
          icon={Receipt}
          tone="emerald"
          label="Ventas hoy"
          value={formatCurrency(Number(salesToday._sum.totalAmount ?? 0))}
          hint={`${salesToday._count} venta${salesToday._count === 1 ? "" : "s"}`}
        />
        <Stat
          href={`/ventas?from=${monthFrom}&to=${monthTo}`}
          icon={CalendarDays}
          tone="violet"
          label="Ventas del mes"
          value={formatCurrency(Number(salesMonth._sum.totalAmount ?? 0))}
          hint={`${salesMonth._count} venta${salesMonth._count === 1 ? "" : "s"}`}
        />
        <Stat
          href="/finanzas"
          icon={summary.profit >= 0 ? TrendingUp : Wallet}
          tone={summary.profit >= 0 ? "emerald" : "amber"}
          label="Utilidad del mes"
          value={formatCurrency(summary.profit)}
          hint="Ver finanzas"
          valueClass={summary.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}
        />
      </section>

      {/* Últimas ventas y vehículos */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Últimas ventas" href="/ventas" linkLabel="Ver todas">
          {recentSales.length === 0 && <p className="py-6 text-center text-muted-foreground">Aún no hay ventas.</p>}
          {recentSales.map((s) => (
            <Link
              key={s.id}
              href={`/ventas/${s.id}`}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-medium">
                  {s.items.map((i) => i.part.partType.name).join(" · ") || "Venta"}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {formatDateTime(s.saleDate)}
                  {s.employee ? ` · ${s.employee.name}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-lg font-semibold">{formatCurrency(s.totalAmount.toString())}</span>
            </Link>
          ))}
        </Panel>

        <Panel title="Vehículos recientes" href="/vehiculos" linkLabel="Ver todos">
          {recentVehicles.length === 0 && <p className="py-6 text-center text-muted-foreground">Aún no hay vehículos.</p>}
          {recentVehicles.map((v) => {
            const available = availableMap.get(v.id) ?? 0;
            return (
              <Link
                key={v.id}
                href={`/vehiculos/${v.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">
                    {v.brand} {v.model} ({v.year})
                  </span>
                  <span className="block text-sm text-muted-foreground">Comprado el {formatDate(v.purchaseDate)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <Badge variant={available > 0 ? "default" : "outline"} className="text-sm">
                    {available} disponible{available === 1 ? "" : "s"}
                  </Badge>
                  <span className="mt-0.5 block text-xs text-muted-foreground">de {v._count.parts} piezas</span>
                </span>
              </Link>
            );
          })}
        </Panel>
      </section>

      {staleParts.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="size-5 text-amber-500" />
            Piezas con mucho tiempo sin venderse (+{STALE_DAYS} días)
          </h2>
          <div className="space-y-1">
            {staleParts.map((p) => (
              <Link
                key={p.id}
                href={`/piezas/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base transition hover:bg-accent"
              >
                <span>
                  {p.partType.name} <span className="font-mono text-sm text-muted-foreground">{p.sku}</span>
                </span>
                <Badge variant="outline">Desde {formatDate(p.createdAt)}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  href,
  icon: Icon,
  tone,
  label,
  value,
  hint,
  valueClass = "",
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-base font-medium text-muted-foreground">{label}</span>
        <span className={`flex size-10 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <div>
        <p className={`text-3xl font-bold tracking-tight ${valueClass}`}>{value}</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          {hint}
          <ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
        </p>
      </div>
    </Link>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Link href={href} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {linkLabel}
          <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="-mx-1">{children}</div>
    </div>
  );
}
