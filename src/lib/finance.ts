import { prisma } from "@/lib/prisma";

export type Period = { from: Date; to: Date };

export function currentMonthPeriod(): Period {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

const OPERATING_EXPENSE_CATEGORIES = ["WAREHOUSE", "UTILITIES", "TOOLS", "OTHER"] as const;
const DISMANTLING_COST_CATEGORIES = ["DISMANTLING_LABOR", "TRANSPORT"] as const;

export async function getFinancialSummary({ from, to }: Period) {
  const dateFilter = { gte: from, lt: to };

  const [salesAgg, vehiclesAgg, dismantlingAgg, operatingAgg] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true }, where: { saleDate: dateFilter } }),
    prisma.sourceVehicle.aggregate({ _sum: { purchaseCost: true }, where: { purchaseDate: dateFilter } }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, category: { in: [...DISMANTLING_COST_CATEGORIES] } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { date: dateFilter, category: { in: [...OPERATING_EXPENSE_CATEGORIES] } },
    }),
  ]);

  const income = Number(salesAgg._sum.totalAmount ?? 0);
  const vehicleCosts = Number(vehiclesAgg._sum.purchaseCost ?? 0);
  const dismantlingCosts = Number(dismantlingAgg._sum.amount ?? 0);
  const operatingExpenses = Number(operatingAgg._sum.amount ?? 0);
  const totalCosts = vehicleCosts + dismantlingCosts;
  const profit = income - totalCosts - operatingExpenses;

  return { income, vehicleCosts, dismantlingCosts, operatingExpenses, totalCosts, profit };
}

export async function getMonthlySales(months = 6) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: start } },
    select: { saleDate: true, totalAmount: true },
  });

  const buckets: { key: string; label: string; total: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("es-EC", { month: "short", year: "2-digit" }),
      total: 0,
    });
  }

  for (const sale of sales) {
    const d = new Date(sale.saleDate);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.total += Number(sale.totalAmount);
  }

  return buckets;
}

export async function getTopSellingParts(limit = 5) {
  const items = await prisma.saleItem.findMany({
    include: { part: { include: { partType: true } } },
  });

  const totals = new Map<string, { id: string; name: string; count: number; revenue: number }>();
  for (const item of items) {
    const key = item.part.partType.id;
    const entry = totals.get(key) ?? { id: key, name: item.part.partType.name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(item.priceSold);
    totals.set(key, entry);
  }

  return Array.from(totals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export type VehicleRow = {
  id: string;
  name: string;
  year: number;
  pieces: number;
  revenue: number;
  cost: number;
  profit: number;
};

// Ingresos por vehículo (suma de todo lo vendido de sus piezas) en un rango de fechas opcional.
export async function getVehicleProfitability(range?: { from?: Date; to?: Date }) {
  const dateFilter =
    range?.from || range?.to ? { saleDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } } : {};

  const [vehicles, items, expenses] = await Promise.all([
    prisma.sourceVehicle.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }] }),
    prisma.saleItem.findMany({
      where: { sale: dateFilter },
      select: { priceSold: true, part: { select: { sourceVehicleId: true } } },
    }),
    prisma.expense.groupBy({ by: ["sourceVehicleId"], _sum: { amount: true } }),
  ]);

  const expenseByVehicle = new Map(expenses.map((e) => [e.sourceVehicleId, Number(e._sum.amount ?? 0)]));
  const agg = new Map<string, { pieces: number; revenue: number }>();
  let unassigned = { pieces: 0, revenue: 0 };
  for (const it of items) {
    const id = it.part.sourceVehicleId;
    const price = Number(it.priceSold);
    if (!id) {
      unassigned = { pieces: unassigned.pieces + 1, revenue: unassigned.revenue + price };
      continue;
    }
    const a = agg.get(id) ?? { pieces: 0, revenue: 0 };
    a.pieces += 1;
    a.revenue += price;
    agg.set(id, a);
  }

  const rows: VehicleRow[] = vehicles.map((v) => {
    const a = agg.get(v.id) ?? { pieces: 0, revenue: 0 };
    const cost = Number(v.purchaseCost) + (expenseByVehicle.get(v.id) ?? 0);
    return {
      id: v.id,
      name: `${v.brand} ${v.model}`,
      year: v.year,
      pieces: a.pieces,
      revenue: a.revenue,
      cost,
      profit: a.revenue - cost,
    };
  });

  return { rows, unassigned };
}

export const COMMISSION_RATE = 0.1; // 10% de lo vendido, pagado normalmente a fin de mes

export type EmployeeRow = {
  id: string;
  name: string;
  salesCount: number;
  revenue: number;
  commission: number;
};

// Cuánto vendió cada empleado (por venta, no por pieza) en un rango de fechas opcional, con su
// comisión del 10%. Las ventas sin empleado asignado se agrupan aparte.
export async function getEmployeeSales(range?: { from?: Date; to?: Date }) {
  const dateFilter =
    range?.from || range?.to ? { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } : undefined;

  const sales = await prisma.sale.findMany({
    where: dateFilter ? { saleDate: dateFilter } : {},
    select: { totalAmount: true, employee: { select: { id: true, name: true } } },
  });

  const agg = new Map<string, EmployeeRow>();
  let unassigned = { salesCount: 0, revenue: 0 };
  for (const s of sales) {
    const amount = Number(s.totalAmount);
    if (!s.employee) {
      unassigned = { salesCount: unassigned.salesCount + 1, revenue: unassigned.revenue + amount };
      continue;
    }
    const row = agg.get(s.employee.id) ?? { id: s.employee.id, name: s.employee.name, salesCount: 0, revenue: 0, commission: 0 };
    row.salesCount += 1;
    row.revenue += amount;
    agg.set(s.employee.id, row);
  }

  const rows = [...agg.values()]
    .map((r) => ({ ...r, commission: r.revenue * COMMISSION_RATE }))
    .sort((a, b) => b.revenue - a.revenue);

  return { rows, unassigned };
}

export async function getVehicleSales(vehicleId: string, range?: { from?: Date; to?: Date }) {
  const dateFilter =
    range?.from || range?.to ? { saleDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } } : {};
  const items = await prisma.saleItem.findMany({
    where: { part: { sourceVehicleId: vehicleId }, sale: dateFilter },
    include: { part: { include: { partType: true } }, sale: { include: { employee: true } } },
    orderBy: { sale: { saleDate: "desc" } },
  });
  return items.map((i) => ({
    id: i.id,
    date: i.sale.saleDate,
    name: i.part.partType.name,
    zone: i.part.partType.zone,
    employee: i.sale.employee?.name ?? null,
    price: Number(i.priceSold),
  }));
}
