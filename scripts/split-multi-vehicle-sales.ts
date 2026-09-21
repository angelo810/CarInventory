import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sales = await prisma.sale.findMany({
    where: { items: { some: {} } },
    include: { items: { include: { part: true }, orderBy: { part: { createdAt: "asc" } } } },
  });

  let splitSales = 0;
  let newSales = 0;

  for (const sale of sales) {
    const byVehicle = new Map<string, typeof sale.items>();
    for (const item of sale.items) {
      const key = item.part.sourceVehicleId ?? "__none__";
      byVehicle.set(key, [...(byVehicle.get(key) ?? []), item]);
    }
    if (byVehicle.size < 2) continue;

    const groups = [...byVehicle.values()];
    const [keep, ...others] = groups;

    for (const group of others) {
      const total = group.reduce((s, i) => s + Number(i.priceSold), 0);
      const created = await prisma.sale.create({
        data: {
          saleDate: sale.saleDate,
          employeeId: sale.employeeId,
          customerId: sale.customerId,
          paymentMethod: sale.paymentMethod,
          notes: sale.notes,
          totalAmount: total,
        },
      });
      await prisma.saleItem.updateMany({
        where: { id: { in: group.map((i) => i.id) } },
        data: { saleId: created.id },
      });
      newSales++;
    }

    await prisma.sale.update({
      where: { id: sale.id },
      data: { totalAmount: keep.reduce((s, i) => s + Number(i.priceSold), 0) },
    });
    splitSales++;
  }

  console.log({ splitSales, newSales });
  await prisma.$disconnect();
}

main();
