/**
 * Separa las ventas migradas de Innomundo en piezas individuales y las hace coincidir
 * con el catálogo de Innomundo (business = INNOMUNDO).
 *
 *   npx tsx scripts/split-and-match-innomundo.ts          -> reporte (no escribe)
 *   npx tsx scripts/split-and-match-innomundo.ts --apply  -> aplica en la base de datos
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCatalog, matchPiece, splitPieces } from "../src/lib/part-matcher";
import { categoryCode } from "../src/lib/sku";
import fs from "node:fs";

import { parseChat, CHAT_PATH } from "./migrate-innomundo";

const APPLY = process.argv.includes("--apply");
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SOLD_AS = "Vendida como: ";

async function main() {
  const catalogRows = await prisma.partType.findMany({
    where: { business: "INNOMUNDO", catalog: true, zone: { not: null } },
    select: { id: true, name: true, zone: true, categoryId: true },
  });
  const catalog = buildCatalog(catalogRows.map((c) => ({ id: c.id, name: c.name, zone: c.zone! })));
  const catalogById = new Map(catalogRows.map((c) => [c.id, c]));

  const parts = await prisma.part.findMany({
    where: {
      business: "INNOMUNDO",
      status: "SOLD",
      OR: [
        { partType: { description: { contains: "Migrado de WhatsApp Innomundo" } } },
        { notes: { startsWith: SOLD_AS } },
      ],
    },
    include: { partType: true, saleItems: true, sourceVehicle: true },
  });

  const records = new Map(parseChat(fs.readFileSync(CHAT_PATH, "utf8")).map((r) => [r.line, r]));
  const lineOf = (text: string | null) => Number(text?.match(/línea (\d+)/)?.[1] ?? 0);
  function originalText(part: (typeof parts)[number]): string {
    const rec = records.get(lineOf(part.partType.description));
    return rec?.description || part.partType.name;
  }

  let special = 0;
  let piecesTotal = 0;
  let matched = 0;
  let sideAssumed = 0;
  const unmatched = new Map<string, { count: number; revenue: number }>();
  const plans: {
    part: (typeof parts)[number];
    pieces: { text: string; match: ReturnType<typeof matchPiece>; price: number }[];
  }[] = [];

  for (const part of parts) {
    const original = part.notes?.startsWith(SOLD_AS)
      ? part.notes.slice(SOLD_AS.length).replace(/( \((lado no especificado|revisar)\))+$/, "")
      : originalText(part);

    if (/^\s*(chatarras?|completo)\b/i.test(original)) {
      special++;
      continue;
    }

    const already = Boolean(part.notes?.startsWith(SOLD_AS));
    const texts = already ? [original] : splitPieces(original);
    if (texts.length === 0) texts.push(original);

    const totalCents = Math.round(Number(part.saleItems[0]?.priceSold ?? part.price) * 100);
    const shares = texts.map(() => Math.floor(totalCents / texts.length));
    shares[0] += totalCents - shares.reduce((a, b) => a + b, 0);

    const pieces = texts.map((text, i) => {
      const match = matchPiece(text, catalog);
      piecesTotal++;
      if (match) {
        matched++;
        if (match.sideAssumed) sideAssumed++;
      } else {
        const key = text.toLowerCase().trim();
        const u = unmatched.get(key) ?? { count: 0, revenue: 0 };
        u.count++;
        u.revenue += shares[i] / 100;
        unmatched.set(key, u);
      }
      return { text, match, price: shares[i] / 100 };
    });
    plans.push({ part, pieces });
  }

  console.log(`Partes vendidas migradas: ${parts.length} (chatarra / vehículo completo sin tocar: ${special})`);
  console.log(`Piezas individuales: ${piecesTotal}`);
  console.log(`Con coincidencia: ${matched} (${((matched / piecesTotal) * 100).toFixed(1)}%), lado no especificado: ${sideAssumed}`);
  console.log(`Sin coincidencia: ${piecesTotal - matched} (${unmatched.size} textos distintos)`);
  const top = [...unmatched.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, Number(process.env.TOP ?? 60));
  console.log("\nTextos sin coincidencia más frecuentes:");
  for (const [text, u] of top) console.log(`  ${String(u.count).padStart(3)}  ${text}`);

  if (!APPLY) {
    console.log("\n(reporte: no se escribió nada. Usa --apply para aplicar.)");
    await prisma.$disconnect();
    return;
  }

  const categories = await prisma.category.findMany();
  const otroId = categories.find((c) => c.name === "Otro")!.id;
  let updatedParts = 0;
  let createdParts = 0;

  for (const plan of plans) {
    const { part, pieces } = plan;
    const saleItem = part.saleItems[0];
    if (!saleItem) continue;

    const extra = pieces.length - 1;
    const seq = extra
      ? await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('part_sku_seq') AS n FROM generate_series(1, ${extra})`
      : [];

    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const note = `${SOLD_AS}${piece.text}${piece.match?.sideAssumed ? " (lado no especificado)" : ""}${piece.match && piece.match.score < 0.75 ? " (revisar)" : ""}`;

      let partTypeId: string;
      if (piece.match) {
        partTypeId = piece.match.entry.id;
      } else {
        const reusable = i === 0 && !part.partType.catalog && part.partType.name === piece.text ? part.partTypeId : null;
        if (reusable) partTypeId = reusable;
        else {
          const t = await prisma.partType.create({
            data: {
              business: "INNOMUNDO",
              name: piece.text.slice(0, 250),
              categoryId: otroId,
              description: part.partType.description,
            },
          });
          partTypeId = t.id;
        }
      }

      if (i === 0) {
        await prisma.part.update({ where: { id: part.id }, data: { partTypeId, price: piece.price, notes: note } });
        await prisma.saleItem.update({ where: { id: saleItem.id }, data: { priceSold: piece.price } });
        updatedParts++;
      } else {
        const catId = piece.match ? catalogById.get(piece.match.entry.id)!.categoryId : otroId;
        const catName = categories.find((c) => c.id === catId)?.name ?? "Otro";
        const created = await prisma.part.create({
          data: {
            business: "INNOMUNDO",
            sku: `${categoryCode(catName)}-${seq[i - 1].n.toString().padStart(6, "0")}`,
            partTypeId,
            sourceVehicleId: part.sourceVehicleId,
            status: "SOLD",
            cost: 0,
            price: piece.price,
            notes: note,
          },
        });
        await prisma.saleItem.create({ data: { saleId: saleItem.saleId, partId: created.id, priceSold: piece.price } });
        createdParts++;
      }
    }
  }

  const orphans = await prisma.partType.deleteMany({
    where: { business: "INNOMUNDO", catalog: false, parts: { none: {} }, description: { contains: "Migrado de WhatsApp Innomundo" } },
  });

  console.log({ updatedParts, createdParts, orphanTypesDeleted: orphans.count });
  await prisma.$disconnect();
}

main();
