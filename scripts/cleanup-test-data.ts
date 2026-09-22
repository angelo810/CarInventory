import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const u = await prisma.user.deleteMany({ where: { email: "test-vendedor@inventory.com" } });
  console.log({ usersDeleted: u.count });
}
main().finally(() => prisma.$disconnect());
