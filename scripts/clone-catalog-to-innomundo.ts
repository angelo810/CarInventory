/**
 * Clona el catálogo curado de MoneyCars (PartType con catalog=true) hacia Innomundo, como punto
 * de partida razonable: los nombres de piezas de auto son en su mayoría genéricos y compartidos
 * entre ambos negocios. No copia compatibilidades ni piezas físicas, solo la lista de nombres.
 *
 *   npx tsx scripts/clone-catalog-to-innomundo.ts            -> reporte
 *   npx tsx scripts/clone-catalog-to-innomundo.ts --commit   -> aplica
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const COMMIT = process.argv.includes("--commit");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const source = await prisma.partType.findMany({
    where: { business: "MONEYCARS", catalog: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const existing = await prisma.partType.findMany({
    where: { business: "INNOMUNDO", catalog: true },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((e) => e.name.toLowerCase()));

  const toCreate = source.filter((s) => !existingNames.has(s.name.toLowerCase()));
  console.log(`Catálogo MoneyCars: ${source.length} tipos. Ya existen en Innomundo: ${source.length - toCreate.length}. A crear: ${toCreate.length}.`);

  if (!COMMIT) {
    console.log("\n(reporte: no se escribió nada. Usa --commit para aplicar.)");
    await prisma.$disconnect();
    return;
  }

  let created = 0;
  for (const s of toCreate) {
    await prisma.partType.create({
      data: {
        business: "INNOMUNDO",
        name: s.name,
        categoryId: s.categoryId,
        zone: s.zone,
        catalog: true,
        kept: s.kept,
        sortOrder: s.sortOrder,
      },
    });
    created++;
  }
  console.log(`Creados: ${created}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
