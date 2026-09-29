/**
 * Igual que fix-month-boundary.ts pero para el chat de Innomundo: corrige el saleDate de las
 * ventas que quedaron mal atribuidas al mes siguiente (mensaje con timestamp del día 1, pero
 * enviado antes del "Cerrado mes de X").
 *
 *   npx tsx scripts/fix-month-boundary-innomundo.ts            -> dry-run
 *   npx tsx scripts/fix-month-boundary-innomundo.ts --commit    -> aplica los cambios
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CHAT_PATH } from "./migrate-innomundo";

const COMMIT = process.argv.includes("--commit");

const WHATSAPP_HEADER = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}) - ([^:]+): (.*)$/;
const CLOSE_RE = /cerrado\s+mes\s+de\s+([a-záéíóú]+)/i;

const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function monthIndexFromName(name: string): number {
  const n = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return MONTHS.findIndex((m) => m.normalize("NFD").replace(/[̀-ͯ]/g, "") === n);
}

type SaleLineInfo = { line: number; date: Date };

const text = fs.readFileSync(CHAT_PATH, "utf8");
const lines = text.split(/\r?\n/);

let currentDate: Date | null = null;
const saleLines: SaleLineInfo[] = [];
const closeMarkers: { line: number; monthIdx: number }[] = [];

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  let content = raw;
  const headerMatch = raw.match(WHATSAPP_HEADER);
  if (headerMatch) {
    const [, d, m, y, hh, mm] = headerMatch;
    currentDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    content = headerMatch[7];
  }
  const date = currentDate ?? new Date(0);

  const closeMatch = content.match(CLOSE_RE);
  if (closeMatch) {
    const idx = monthIndexFromName(closeMatch[1]);
    if (idx >= 0) closeMarkers.push({ line: i + 1, monthIdx: idx });
  }

  if (/\d+(?:[.,]\d{1,2})?\s*\$/.test(content)) {
    saleLines.push({ line: i + 1, date });
  }
}

const issues: { line: number; date: Date; closedMonthIdx: number }[] = [];
for (const marker of closeMarkers) {
  const before = saleLines.filter((s) => s.line < marker.line);
  for (let i = before.length - 1; i >= 0; i--) {
    const s = before[i];
    if (s.date.getMonth() === marker.monthIdx) break;
    issues.push({ line: s.line, date: s.date, closedMonthIdx: marker.monthIdx });
  }
}

function daysInMonth(year: number, monthIdx: number) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function correctedDate(original: Date, closedMonthIdx: number): Date {
  let year = original.getFullYear();
  if (closedMonthIdx > original.getMonth()) year -= 1;
  const day = daysInMonth(year, closedMonthIdx);
  return new Date(year, closedMonthIdx, day, original.getHours(), original.getMinutes());
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log(`Ventas a revisar: ${issues.length}\n`);

  let matched = 0;
  let notFound = 0;

  for (const it of issues) {
    const marker = `(línea ${it.line})`;
    const sales = await prisma.sale.findMany({
      where: { business: "INNOMUNDO", notes: { contains: marker } },
      include: { items: { include: { part: { include: { partType: true } } } } },
    });
    const newDate = correctedDate(it.date, it.closedMonthIdx);

    if (sales.length === 0) {
      notFound++;
      continue;
    }
    matched++;
    for (const sale of sales) {
      console.log(
        `  línea ${it.line} (venta ${sale.id.slice(0, 8)}…): ${sale.saleDate.toISOString().slice(0, 10)} -> ${newDate.toISOString().slice(0, 10)} | $${sale.totalAmount} | ${sale.items.map((i) => i.part.partType.name).join(" + ")}`,
      );
      if (COMMIT) {
        await prisma.sale.update({ where: { id: sale.id }, data: { saleDate: newDate } });
      }
    }
  }

  console.log(`\nEncontradas: ${matched}, no encontradas: ${notFound}`);
  console.log(COMMIT ? "\nCambios aplicados." : "\n(dry-run: no se escribió nada. Usa --commit para aplicar.)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
