/**
 * Exporta el catálogo (PartType con catalog=true) de un negocio a JSON, para generar el PDF
 * de revisión.
 *
 *   npx tsx scripts/export-catalog.ts <MONEYCARS|INNOMUNDO> <ruta-salida.json>
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const business = (process.argv[2] as "MONEYCARS" | "INNOMUNDO") ?? "MONEYCARS";
const outPath = process.argv[3] ?? "catalog-export.json";

const ZONE_LABELS: Record<string, string> = {
  INTERIOR: "Interior",
  MECHANICAL: "Mecánico",
  EXTERIOR: "Exterior",
  DOCUMENTS: "Documentos",
  SCRAP: "Chatarra",
  COMPLETE: "Completo",
};

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const types = await prisma.partType.findMany({
    where: { business, catalog: true },
    include: { category: true, _count: { select: { parts: true } } },
    orderBy: [{ zone: "asc" }, { category: { name: "asc" } }, { name: "asc" }],
  });

  const rows = types.map((t) => ({
    zone: t.zone ? (ZONE_LABELS[t.zone] ?? t.zone) : "Sin zona",
    category: t.category.name,
    name: t.name,
    kept: t.kept,
    usedInParts: t._count.parts,
  }));

  fs.writeFileSync(outPath, JSON.stringify({ business, total: rows.length, rows }, null, 2));
  console.log(`Exportado ${rows.length} tipos de ${business} a ${outPath}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
