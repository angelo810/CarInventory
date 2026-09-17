import { prisma } from "@/lib/prisma";

function categoryCode(categoryName: string) {
  const letters = categoryName.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, 3) || "PRT").padEnd(3, "X");
}

export async function generateSku(categoryName: string) {
  const [{ nextval }] = await prisma.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('part_sku_seq')
  `;
  const sequence = nextval.toString().padStart(6, "0");
  return `${categoryCode(categoryName)}-${sequence}`;
}
