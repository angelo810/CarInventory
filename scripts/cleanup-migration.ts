import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const sales = await prisma.sale.deleteMany({
    where: { notes: { contains: "Migrado de WhatsApp" } },
  });
  // Elimina PartTypes migrados (por descripción) junto con sus Parts
  const partTypes = await prisma.partType.findMany({
    where: { description: { contains: "Migrado de WhatsApp" } },
    select: { id: true },
  });
  const partTypeIds = partTypes.map((p) => p.id);
  const partsFromTypes = await prisma.part.deleteMany({
    where: { partTypeId: { in: partTypeIds } },
  });
  const partTypesDeleted = await prisma.partType.deleteMany({
    where: { id: { in: partTypeIds } },
  });
  const vehicles = await prisma.sourceVehicle.deleteMany({
    where: { notes: { contains: "Migrado desde historial de WhatsApp" } },
  });

  console.log({
    salesDeleted: sales.count,
    partsFromTypesDeleted: partsFromTypes.count,
    partTypesDeleted: partTypesDeleted.count,
    vehiclesDeleted: vehicles.count,
  });

  await prisma.$disconnect();
}

main();
