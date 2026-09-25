import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateSku } from "../src/lib/sku";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SOLD_AS = "Vendida como: ";
const TEXT = "retrovisor chapa lamevidrios moldura manija externa vidrio";

// Confirmado por el contexto original del chat ("puerta delantera Rh con retrovisor chapa
// lamevidrios moldura manija externa vidrio+ ..."): todas del lado RH, puerta delantera.
const COMPONENTS: { catalogName: string; confident: boolean }[] = [
  { catalogName: "Retrovisor lateral RH", confident: true },
  { catalogName: "Cerradura puerta delantera RH", confident: true },
  { catalogName: "Lamevidrios interno puerta delantera RH", confident: false }, // interno vs externo no está claro
  { catalogName: "Manija puerta delantera RH", confident: false }, // "moldura manija externa": podría ser Jaladera puerta delantera RH
  { catalogName: "Vidrio delantero RH", confident: true },
];

async function main() {
  const part = await prisma.part.findFirst({
    where: { notes: `${SOLD_AS}${TEXT}` },
    include: { partType: true, saleItems: true },
  });
  if (!part) {
    console.log("No encontré la pieza (¿ya se dividió?).");
    return;
  }
  if (part.saleItems.length !== 1) throw new Error("Se esperaba exactamente 1 SaleItem");
  const saleId = part.saleItems[0].saleId;
  const oldTypeId = part.partTypeId;

  const catalogTypes = await prisma.partType.findMany({
    where: { name: { in: COMPONENTS.map((c) => c.catalogName) }, catalog: true },
    include: { category: true },
  });
  const byName = new Map(catalogTypes.map((t) => [t.name, t]));
  for (const c of COMPONENTS) {
    if (!byName.get(c.catalogName)) throw new Error(`No encontré en catálogo: ${c.catalogName}`);
  }

  const totalCents = Math.round(Number(part.price) * 100);
  const share = Math.floor(totalCents / COMPONENTS.length);
  const remainder = totalCents - share * COMPONENTS.length;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < COMPONENTS.length; i++) {
      const { catalogName, confident } = COMPONENTS[i];
      const type = byName.get(catalogName)!;
      const priceCents = share + (i === 0 ? remainder : 0);
      const price = priceCents / 100;
      const sku = await generateSku(type.category.name);

      const newPart = await tx.part.create({
        data: {
          sku,
          partTypeId: type.id,
          sourceVehicleId: part.sourceVehicleId,
          condition: part.condition,
          status: "SOLD",
          cost: 0,
          price,
          notes: `${SOLD_AS}${TEXT}${confident ? "" : " (revisar)"}`,
        },
      });
      await tx.saleItem.create({ data: { saleId, partId: newPart.id, priceSold: price } });
    }

    await tx.saleItem.deleteMany({ where: { partId: part.id } });
    await tx.part.delete({ where: { id: part.id } });
    await tx.partType.deleteMany({ where: { id: oldTypeId, catalog: false, parts: { none: {} } } });
  });

  console.log(`Dividida en ${COMPONENTS.length} piezas.`);
}
main().finally(() => prisma.$disconnect());
