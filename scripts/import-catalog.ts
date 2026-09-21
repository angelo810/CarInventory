import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { inferCategory } from "../src/lib/categorize";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Entry = { name: string; zone: "INTERIOR" | "MECHANICAL" | "EXTERIOR"; kept: boolean; sortOrder: number };

const ZONE_FALLBACK: Record<Entry["zone"], string> = {
  INTERIOR: "Interior",
  MECHANICAL: "Motor",
  EXTERIOR: "Carrocería",
};

async function main() {
  const entries: Entry[] = JSON.parse(fs.readFileSync("prisma/catalog.json", "utf8"));
  const categories = await prisma.category.findMany();
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));

  let created = 0;
  let updated = 0;

  for (const e of entries) {
    // La zona manda: Interior/Exterior conservan su categoría, salvo eléctricas; Mecánico usa la inferida.
    const inferred = inferCategory(e.name);
    let catName = ZONE_FALLBACK[e.zone];
    if (inferred === "Eléctrico") catName = inferred;
    else if (e.zone === "MECHANICAL" && ["Motor", "Suspensión", "Frenos", "Transmisión", "Escape"].includes(inferred)) catName = inferred;
    const catId = categoryId.get(catName) ?? categoryId.get("Otro")!;

    const existing = await prisma.partType.findFirst({
      where: { catalog: true, zone: e.zone, name: e.name },
    });

    if (existing) {
      await prisma.partType.update({
        where: { id: existing.id },
        data: { kept: e.kept, sortOrder: e.sortOrder, categoryId: catId },
      });
      updated++;
    } else {
      await prisma.partType.create({
        data: { name: e.name, zone: e.zone, kept: e.kept, sortOrder: e.sortOrder, catalog: true, categoryId: catId },
      });
      created++;
    }
  }

  console.log({ created, updated, total: entries.length });
  await prisma.$disconnect();
}

main();
