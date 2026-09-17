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

  const totals = new Map<string, { name: string; count: number; revenue: number }>();
  for (const item of items) {
    const key = item.part.partType.id;
    const entry = totals.get(key) ?? { name: item.part.partType.name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(item.priceSold);
    totals.set(key, entry);
  }

  return Array.from(totals.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
