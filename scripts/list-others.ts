import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const types = await prisma.partType.findMany({
    where: { catalog: false },
    select: { name: true, _count: { select: { parts: true } } },
  });
  const m = new Map<string, number>();
  for (const t of types) m.set(t.name, (m.get(t.name) ?? 0) + t._count.parts);
  console.log(types.length, "tipos;", m.size, "nombres distintos");
  console.log([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([n, c]) => `${c}\t${n}`).join("\n"));
}
main().finally(() => prisma.$disconnect());
