import { prisma } from "@/lib/prisma";

const N_IN_NOTES = /(?:^|[^A-Za-z0-9])N(\d{2,6})(?![A-Za-z0-9])/;

/**
 * Número de la próxima nota de venta ("N1450"): el mayor número N#### de las ventas más recientes + 1.
 * La numeración es una sola para las dos empresas (MoneyCars e Innomundo comparten el mismo contador).
 */
export async function nextSaleNote(): Promise<string> {
  const recent = await prisma.sale.findMany({
    orderBy: { saleDate: "desc" },
    take: 150,
    select: { notes: true },
  });
  let max = 0;
  for (const s of recent) {
    const m = s.notes?.match(N_IN_NOTES);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max ? `N${max + 1}` : "";
}
