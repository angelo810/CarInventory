import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const r = await prisma.user.updateMany({ data: { role: "ADMIN" } });
  console.log(r);
  console.log(await prisma.user.findMany({ select: { email: true, role: true } }));
}
main().finally(() => prisma.$disconnect());
