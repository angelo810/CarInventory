/**
 * Agrega al sistema de Innomundo las ventas del chat que no traían el signo "$"
 * (ej. "cabeceras Optra azul 100") y por eso el importador se las saltó.
 * Solo las que son claramente una venta (pieza + precio + a veces "recibe X"); se descartan
 * los "tope" de precio, las listas con totales ambiguos y las cuentas/recaps.
 *
 *   npx tsx scripts/agregar-ventas-sin-signo-innomundo.ts           -> simulación
 *   npx tsx scripts/agregar-ventas-sin-signo-innomundo.ts --commit  -> aplica
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCatalog, matchPiece } from "../src/lib/part-matcher";
import { categoryCode } from "../src/lib/sku";
import { inferCategory } from "../src/lib/categorize";

const COMMIT = process.argv.includes("--commit");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Item = { text: string; price: number; free?: boolean };
type S = {
  line: number;
  date?: [number, number, number, number, number]; // año, mes, día, hora, min (si falta, se toma del chat)
  employee: string;
  vehicle: string | null; // model de SourceVehicle (Innomundo)
  items: Item[];
  pending?: boolean;
};

const SALES: S[] = [
  { line: 6128, date: [2026, 6, 10, 11, 46], employee: "Esteban", vehicle: "Optra Azul", items: [{ text: "cabeceras Optra azul", price: 100 }] },
  { line: 1188, date: [2022, 9, 12, 10, 21], employee: "Esteban", vehicle: "Logan Taxi", items: [{ text: "Espiral delantero Logan taxi", price: 17.5 }] },
  { line: 1449, date: [2022, 10, 18, 11, 29], employee: "Esteban", vehicle: null, items: [{ text: "Chatarra taller 2", price: 10.5 }] },
  { line: 375, date: [2022, 5, 18, 14, 42], employee: "Contá", vehicle: "D-Max Diésel", items: [{ text: "Llanta luv Dmax", price: 70 }] },
  { line: 326, date: [2022, 5, 12, 13, 13], employee: "Esteban", vehicle: "Gol 3P", items: [{ text: "Cuerpo de aceleración gol 1.8", price: 80 }] },
  { line: 303, date: [2022, 5, 9, 15, 21], employee: "Contá", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Tapa depurador de aire Corsa wind", price: 30 }] },
  { line: 297, date: [2022, 5, 9, 13, 22], employee: "Carlos Albán", vehicle: "X-Trail Extreme", items: [{ text: "Computadora Nissan Xtrail Xtreme", price: 400 }] },
  { line: 209, date: [2022, 4, 26, 10, 4], employee: "Carlos Albán", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Tablero Corsa win", price: 150 }] },
  { line: 241, date: [2022, 4, 30, 15, 18], employee: "Esteban", vehicle: "Zoyte", items: [{ text: "2 llantas rin 17 zoyte", price: 120, free: true }] },
  { line: 225, date: [2022, 4, 28, 16, 6], employee: "Esteban", vehicle: "Zoyte", items: [{ text: "Sensor oxígeno con soquete zoyte", price: 30 }] },
  { line: 134, date: [2022, 4, 14, 15, 45], employee: "Carlos Albán", vehicle: "Festiva / F150", items: [{ text: "Caja de cambios Ford festiva", price: 200 }] },
  { line: 136, date: [2022, 4, 14, 15, 58], employee: "Esteban", vehicle: null, items: [{ text: "Tapicería interior Corsa lado derecho", price: 60 }], pending: true },
  { line: 104, date: [2022, 4, 11, 15, 8], employee: "Carlos Albán", vehicle: "Mégane", items: [{ text: "módulo Mégane", price: 120 }] },
  { line: 126, date: [2022, 4, 14, 9, 45], employee: "Esteban", vehicle: "Golf Vino", items: [{ text: "caja de cambios golf + porta monedero", price: 450 }] },
  { line: 342, date: [2022, 5, 13, 8, 43], employee: "Esteban", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Manija conductor Corsa wind", price: 15 }] },
  { line: 272, date: [2022, 5, 6, 15, 48], employee: "Carlos Albán", vehicle: null, items: [{ text: "Volante", price: 150 }, { text: "Mando de plumas", price: 100 }] },
  { line: 318, date: [2022, 5, 11, 12, 55], employee: "Esteban", vehicle: "Mégane", items: [{ text: "Airbag, cauchos y manijas megane", price: 150 }] },
  { line: 499, date: [2022, 6, 1, 15, 35], employee: "Esteban", vehicle: "Zoyte", items: [{ text: "Plástico cinturón zoyte", price: 35 }] },
  { line: 68, date: [2022, 4, 4, 8, 6], employee: "Esteban", vehicle: null, items: [{ text: "Tapas de la puerta Corsa", price: 20 }] },
  { line: 75, date: [2022, 4, 6, 16, 42], employee: "Esteban", vehicle: "Zoyte", items: [{ text: "Punta homocinética izquierda zoyte", price: 30 }] },
  { line: 244, date: [2022, 5, 2, 14, 53], employee: "Esteban", vehicle: "Festiva / F150", items: [{ text: "Cristal izquierdo festiva", price: 35 }] },
  { line: 222, date: [2022, 4, 28, 11, 12], employee: "Esteban", vehicle: "Golf Vino", items: [{ text: "Chapa y motor de plumas golf", price: 80 }] },
  // "dolares"/"usd" (formato de Mateo y otros) y abril–mayo de 2022 sin signo
  { line: 74, employee: "Esteban", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Moldura puerta, mandos de vidrios y consola central Corsa wind", price: 90 }] },
  { line: 100, employee: "Carlos Albán", vehicle: "X-Trail Extreme", items: [{ text: "Radiador, guardachoque delantero, capó, radiador de soporte y puerta izquierda xtrail", price: 720 }] },
  { line: 116, employee: "Carlos Albán", vehicle: "Golf Vino", items: [{ text: "Retrovisor LH, contenedor hidráulico y plástico freno de mano golf", price: 70 }] },
  { line: 144, employee: "Esteban", vehicle: null, items: [{ text: "Capot", price: 100 }, { text: "Faros", price: 40 }, { text: "Electroventilador + radiador", price: 80 }, { text: "Guardachoque", price: 40 }, { text: "Mascarilla", price: 10 }, { text: "Guardafangos", price: 60 }] },
  { line: 169, employee: "Esteban", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Tablero + calefactor Corsa win", price: 310 }] },
  { line: 177, employee: "Esteban", vehicle: "Festiva / F150", items: [{ text: "Puente festiva", price: 95 }] },
  { line: 215, employee: "Carlos Albán", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Viseras + agarraderas Corsa win", price: 65 }] },
  { line: 218, employee: "Esteban", vehicle: "Golf Vino", items: [{ text: "Bomba hidráulica golf sin base", price: 35 }] },
  { line: 235, employee: "Esteban", vehicle: null, items: [{ text: "Fusiblera + pote de plumas corsa", price: 130 }] },
  { line: 266, employee: "Carlos Albán", vehicle: "Gol 3P", items: [{ text: "moldura tablero gol", price: 30 }] },
  { line: 280, employee: "Esteban", vehicle: "Zoyte", items: [{ text: "Módulos zoyte", price: 950 }] },
  { line: 356, employee: "Carlos Albán", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Rejillas calefacción, tapa del computador, mandos calefacción y mando de luces Corsa wind", price: 160 }] },
  { line: 359, employee: "Esteban", vehicle: "Corsa Wind 1.6 Sedán", items: [{ text: "Ejes Corsa wind", price: 150 }] },
  { line: 845, employee: "Mateo", vehicle: "Corsa Wind 1.6 Verde", items: [{ text: "Cuerpo de aceleración corsa wind verde", price: 90 }] },
  { line: 847, employee: "Mateo", vehicle: "Corsa Wind 1.6 Verde", items: [{ text: "Barras templadoras izquierda y derecha corsa wind verde", price: 50 }] },
  { line: 861, employee: "Carlos Albán", vehicle: "Corsa Wind 1.6 Verde", items: [{ text: "Punta compacto izquierdo Corsa verde", price: 130 }] },
  { line: 867, employee: "Esteban", vehicle: "Logan", items: [{ text: "Logan: cárter + lámevidrio delantero izq int + araña izq + mesa izq + manguera de freno izq", price: 140 }] },
  { line: 879, employee: "Esteban", vehicle: "Corsa Wind 1.6 Verde", items: [{ text: "Base de sensor ckp corsa verde", price: 35 }] },
  { line: 902, employee: "Esteban", vehicle: "Corsa Wind 1.6 Verde", items: [{ text: "Espiral posterior corsa verde", price: 10 }] },
  { line: 1088, employee: "Mateo", vehicle: "Logan", items: [{ text: "Sensor ckp Logan", price: 20 }] },
  { line: 1090, employee: "Mateo", vehicle: "Logan", items: [{ text: "Lámevidrio interno delantero derecho", price: 15 }] },
  { line: 1190, employee: "Mateo", vehicle: null, items: [{ text: "2 pernos cabezote Corsa", price: 10, free: true }] },
];

const SOLD_AS = "Vendida como: ";

// fecha/hora de un mensaje del chat: la del último encabezado "d/m/aaaa, hh:mm - " en o antes de esa línea
const HDR = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}) - /;
function dateFromChat(chat: string[], line: number): [number, number, number, number, number] {
  for (let i = line - 1; i >= 0; i--) {
    const m = chat[i].match(HDR);
    if (m) return [Number(m[3]), Number(m[2]), Number(m[1]), Number(m[4]), Number(m[5])];
  }
  throw new Error(`Sin encabezado para la línea ${line}`);
}
// el nombre del auto no ayuda a emparejar la pieza con el catálogo
const VEHICLE_WORDS = /\b(optra|azul|logan|taxi|corsa|wind|win|zoyte|golf|gol|festiva|ford|m[eé]gane|nissan|xtrail|xtreme|dmax|luv|1\.8)\b/gi;
const forMatch = (it: Item) => {
  if (it.free) return null;
  const m = matchPiece(it.text.replace(VEHICLE_WORDS, " ").replace(/\s+/g, " ").trim(), catalogRef);
  return m && m.score >= 0.99 && m.score <= 1 ? m : null;
};
let catalogRef: ReturnType<typeof buildCatalog> = [];
const money = (n: number) => n.toFixed(2);

async function main() {
  console.log(COMMIT ? "== APLICANDO ==" : "== SIMULACIÓN ==");
  const chat = fs.readFileSync(process.argv.find((a) => a.endsWith(".txt"))!, "utf8").split(/\r?\n/);
  const categories = await prisma.category.findMany();
  const catByName = new Map(categories.map((c) => [c.name, c.id]));
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
  const catalogRows = await prisma.partType.findMany({
    where: { business: "INNOMUNDO", catalog: true, zone: { not: null } },
    select: { id: true, name: true, zone: true, categoryId: true },
  });
  const catalog = buildCatalog(catalogRows.map((c) => ({ id: c.id, name: c.name, zone: c.zone! })));
  catalogRef = catalog;
  const catOfType = new Map(catalogRows.map((c) => [c.id, c.categoryId]));
  const employees = await prisma.employee.findMany();
  const empId = new Map(employees.map((e) => [e.name, e.id]));
  const vehicles = await prisma.sourceVehicle.findMany({ where: { business: "INNOMUNDO" } });
  const vehId = (model: string | null) => {
    if (!model) return null;
    const v = vehicles.filter((x) => x.model === model || `${x.model}` === model);
    if (v.length !== 1) throw new Error(`Vehículo "${model}": se esperaba 1 y hay ${v.length}`);
    return v[0].id;
  };

  let added = 0;
  let total = 0;
  for (const s of SALES) {
    const dd = s.date ?? dateFromChat(chat, s.line);
    const date = new Date(dd[0], dd[1] - 1, dd[2], dd[3], dd[4], 0);
    const amount = s.items.reduce((a, i) => a + i.price, 0);
    const marker = `Migrado de WhatsApp Innomundo (línea ${s.line}, sin signo $)${s.pending ? " — PAGO PENDIENTE" : ""}`;
    const dayStart = new Date(dd[0], dd[1] - 1, dd[2], 0, 0, 0);
    const dayEnd = new Date(dd[0], dd[1] - 1, dd[2], 23, 59, 59);
    const dup = await prisma.sale.findFirst({
      where: {
        business: "INNOMUNDO",
        OR: [{ notes: { contains: `(línea ${s.line}, sin signo $)` } }, { saleDate: { gte: dayStart, lte: dayEnd }, totalAmount: amount }],
      },
      select: { notes: true },
    });
    if (!empId.has(s.employee)) console.log(`  (!) empleado "${s.employee}" no existe en el sistema`);
    console.log(`${dup ? "= OMITIDA (ya existe)" : "+"} línea ${s.line} ${date.toLocaleString("es-EC")} ${s.employee} [${s.vehicle ?? "sin vehículo"}] $${money(amount)}`);
    for (const it of s.items) {
      const m = forMatch(it);
      console.log(`     $${money(it.price).padStart(7)} ${it.text} -> ${m ? `${m.entry.name} (${m.score.toFixed(2)})` : "texto libre (Revisar coincidencias)"}`);
    }
    if (dup || !COMMIT) { if (!dup) total += amount; continue; }

    const sale = await prisma.sale.create({
      data: { business: "INNOMUNDO", employeeId: empId.get(s.employee), saleDate: date, totalAmount: amount, notes: marker },
    });
    const sv = vehId(s.vehicle);
    for (const it of s.items) {
      const good = forMatch(it);
      let partTypeId: string;
      let categoryName: string;
      let note: string;
      if (good) {
        partTypeId = good.entry.id;
        categoryName = catNameById.get(catOfType.get(good.entry.id)!) ?? "Otro";
        note = `${SOLD_AS}${it.text}${good.sideAssumed ? " (lado no especificado)" : ""}`;
      } else {
        categoryName = inferCategory(it.text);
        const t = await prisma.partType.create({
          data: {
            business: "INNOMUNDO",
            name: it.text.slice(0, 250),
            categoryId: catByName.get(categoryName) ?? catByName.get("Otro")!,
            description: `Migrado de WhatsApp Innomundo, línea ${s.line} (sin signo $): "${it.text}"`,
          },
        });
        partTypeId = t.id;
        note = `${SOLD_AS}${it.text}`;
      }
      const seq = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('part_sku_seq') AS n`;
      const part = await prisma.part.create({
        data: {
          business: "INNOMUNDO",
          sku: `${categoryCode(categoryName)}-${seq[0].n.toString().padStart(6, "0")}`,
          partTypeId,
          sourceVehicleId: sv,
          condition: "USED_GOOD",
          status: "SOLD",
          cost: 0,
          price: it.price,
          notes: note,
        },
      });
      await prisma.saleItem.create({ data: { saleId: sale.id, partId: part.id, priceSold: it.price } });
    }
    added++;
    total += amount;
  }
  console.log(`\n${COMMIT ? "Agregadas" : "Se agregarían"}: ${COMMIT ? added : SALES.length} ventas | $${money(total)}`);
}

main().finally(() => prisma.$disconnect());
