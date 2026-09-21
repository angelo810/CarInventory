/**
 * Migración de ventas históricas desde el chat de WhatsApp "MoneyCars".
 *
 * Uso:
 *   npx tsx scripts/migrate-whatsapp.ts            -> modo dry-run (solo reporte)
 *   npx tsx scripts/migrate-whatsapp.ts --commit    -> inserta en la base de datos
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PartCondition, PartStatus } from "../src/generated/prisma/enums";

const CHAT_PATH =
  "C:\\Users\\anghe\\AppData\\Local\\Temp\\Chat de WhatsApp con MoneyCars.txt";
const UNIFICATION_DATE = new Date("2026-02-18T00:00:00");

const COMMIT = process.argv.includes("--commit");
const FIX = process.argv.includes("--fix");
const REGROUP = process.argv.includes("--regroup");

// ---------------------------------------------------------------------------
// Vehículos de origen conocidos (desde "NOMBRES AUTOS.docx")
// tag: como aparece en el chat (regex-friendly, se compara sin espacios/case)
// ---------------------------------------------------------------------------
type VehicleDef = {
  tag: string; // clave única interna
  brand: string;
  model: string;
  aliases: string[]; // patrones a buscar en el texto (minúsculas, sin espacios)
};

const VEHICLES: VehicleDef[] = [
  { tag: "TOYOTA_1000", brand: "Toyota", model: "1000", aliases: ["toyota1000", "toyotamil"] },
  { tag: "TIIDA", brand: "Nissan", model: "Tiida", aliases: ["nissantiida", "tiida", "tiiida"] },
  { tag: "LOGAN1", brand: "Renault", model: "Logan 1", aliases: ["logan1"] },
  { tag: "LOGAN2", brand: "Renault", model: "Logan 2", aliases: ["logan2", "loganazul"] },
  { tag: "LOGAN3", brand: "Renault", model: "Logan 3", aliases: ["logan3"] },
  { tag: "SPARK1", brand: "Chevrolet", model: "Spark 1", aliases: ["spark1", "sparkplomo"] },
  { tag: "SPARK2", brand: "Chevrolet", model: "Spark 2", aliases: ["spark2", "sparkrojo"] },
  { tag: "SPARK3", brand: "Chevrolet", model: "Spark 3", aliases: ["spark3"] },
  { tag: "SPARK4", brand: "Chevrolet", model: "Spark 4", aliases: ["spark4"] },
  { tag: "AVEO_EMOTION1", brand: "Chevrolet", model: "Aveo Emotion 1", aliases: ["aveoemotion1", "aveoemotion", "aveo"] },
  { tag: "COROLLA1", brand: "Toyota", model: "Corolla 1", aliases: ["corolla1"] },
  { tag: "COROLLA2", brand: "Toyota", model: "Corolla 2", aliases: ["corolla2", "corollablanco"] },
  { tag: "COROLLA3", brand: "Toyota", model: "Corolla 3", aliases: ["corolla3", "corollacielo"] },
  { tag: "COROLLA4", brand: "Toyota", model: "Corolla 4", aliases: ["corolla4"] },
  { tag: "OPTRA1", brand: "Chevrolet", model: "Optra 1", aliases: ["optra1", "optraverde"] },
  { tag: "OPTRA2", brand: "Chevrolet", model: "Optra 2", aliases: ["optra2", "optraazul"] },
  { tag: "OPTRA3", brand: "Chevrolet", model: "Optra 3", aliases: ["optra3", "optrarojo"] },
  { tag: "OPTRA4", brand: "Chevrolet", model: "Optra 4", aliases: ["optra4", "optrablanco"] },
  { tag: "OPTRA5", brand: "Chevrolet", model: "Optra 5", aliases: ["optra5", "optradorado"] },
  { tag: "YARIS", brand: "Toyota", model: "Yaris", aliases: ["yaris"] },
  { tag: "SANDERO", brand: "Renault", model: "Sandero", aliases: ["sandero"] },
  { tag: "CORSA_EVO1", brand: "Chevrolet", model: "Corsa Evolution 1", aliases: ["corsaevo1", "corsaevolucion1", "corsaevolution1"] },
  { tag: "CORSA_EVO2", brand: "Chevrolet", model: "Corsa Evolution 2", aliases: ["corsaevo2", "corsaevolucion2", "corsaevolution2"] },
  { tag: "CORSA_EVO3", brand: "Chevrolet", model: "Corsa Evolution 3", aliases: ["corsaevo3", "corsaevolucion3", "corsaevolution3"] },
  { tag: "CORSA_EVO4", brand: "Chevrolet", model: "Corsa Evolution 4", aliases: ["corsaevo4", "corsaevolucion4", "corsaevolution4"] },
  { tag: "CORSA_EVO5", brand: "Chevrolet", model: "Corsa Evolution 5", aliases: ["corsaevo5", "corsaevolucion5", "corsaevolution5"] },
  { tag: "POLO", brand: "Volkswagen", model: "Polo", aliases: ["polo"] },
  { tag: "MAZDA5", brand: "Mazda", model: "5", aliases: ["mazda5"] },
  { tag: "VITARA", brand: "Suzuki", model: "Vitara 3P", aliases: ["vitara3p", "vitara"] },
  { tag: "XTRAIL", brand: "Nissan", model: "X-Trail T30", aliases: ["xtrailt30", "xtrail", "xtrial"] },
];

// Orden por longitud de alias descendente para evitar matches parciales (spark1 antes que spark)
const ALIAS_LOOKUP = VEHICLES.flatMap((v) => v.aliases.map((a) => ({ alias: a, vehicle: v }))).sort(
  (a, b) => b.alias.length - a.alias.length,
);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function findVehicle(text: string): { vehicle: VehicleDef; matched: string } | null {
  const normalized = stripDiacritics(text.toLowerCase()).replace(/[\s._-]/g, "");
  for (const { alias, vehicle } of ALIAS_LOOKUP) {
    if (normalized.includes(alias)) {
      return { vehicle, matched: alias };
    }
  }
  return null;
}

// Quita del texto original la subcadena que generó el alias (búsqueda tolerante a espacios/acentos)
function stripVehicleMention(text: string, alias: string): string {
  // Construye un regex que permite espacios opcionales y una vocal con o sin tilde entre cada caracter del alias
  const accentable: Record<string, string> = { a: "aá", e: "eé", i: "ií", o: "oó", u: "uú" };
  const pattern = alias
    .split("")
    .map((ch) => {
      const esc = ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return accentable[ch] ? `[${accentable[ch]}]` : esc;
    })
    .join("\\s*");
  const re = new RegExp(pattern, "i");
  return text.replace(re, " ");
}

type PartGroup = { vehicleTag: string | null; description: string; weight: number };

function aliasPattern(alias: string): string {
  const accentable: Record<string, string> = { a: "aá", e: "eé", i: "ií", o: "oó", u: "uú" };
  return alias
    .split("")
    .map((ch) => (accentable[ch] ? `[${accentable[ch]}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("\\s*");
}

// Divide por "+", descarta segmentos de Inno y limpia espacios
function cleanPieces(text: string): string[] {
  return text
    .split("+")
    .map((p) => p.replace(/\s{2,}/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim())
    .filter((p) => p && !/inn/i.test(p));
}

// Cada auto mencionado cierra el grupo de piezas que va antes (hasta el auto anterior).
function splitGroups(body: string): PartGroup[] {
  const mentions: { index: number; end: number; tag: string }[] = [];
  for (const { alias, vehicle } of ALIAS_LOOKUP) {
    const re = new RegExp(aliasPattern(alias), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const index = m.index;
      const end = index + m[0].length;
      if (!mentions.some((x) => index < x.end && end > x.index)) mentions.push({ index, end, tag: vehicle.tag });
    }
  }
  mentions.sort((a, b) => a.index - b.index);

  const distinct = new Set(mentions.map((m) => m.tag));
  if (distinct.size < 2) {
    let text = body;
    for (const m of [...mentions].reverse()) text = text.slice(0, m.index) + " " + text.slice(m.end);
    const pieces = cleanPieces(text);
    return [{ vehicleTag: mentions[0]?.tag ?? null, description: pieces.join(" + "), weight: pieces.length }];
  }

  const groups: PartGroup[] = [];
  let pos = 0;
  for (const m of mentions) {
    const pieces = cleanPieces(body.slice(pos, m.index));
    pos = m.end;
    if (pieces.length === 0) continue;
    groups.push({ vehicleTag: m.tag, description: pieces.join(" + "), weight: pieces.length });
  }
  const rest = cleanPieces(body.slice(pos));
  if (rest.length && groups.length) {
    const last = groups[groups.length - 1];
    last.description += " + " + rest.join(" + ");
    last.weight += rest.length;
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Empleados: normalización de variantes de escritura
// ---------------------------------------------------------------------------
const EMPLOYEE_ALIASES: Record<string, string> = {
  martin: "Martin",
  "martín": "Martin",
  daniela: "Daniela",
  danielA: "Daniela",
  ale: "Ale",
  stiven: "Stiven",
  joshua: "Joshua",
  mayita: "Mayita",
  mayi: "Mayita",
  stalin: "Stalin",
  taco: "Taco",
  jeferson: "Jeferson",
  evo: "Evo",
  karina: "Karina",
  "josé": "José",
  jose: "José",
  keila: "Keila",
  diana: "Diana",
  sofia: "Sofia",
  "sofía": "Sofia",
  melissa: "Melissa",
  melisa: "Melissa",
  nando: "Nando",
  esteban: "Esteban",
};

function normalizeEmployee(raw: string): string {
  const cleaned = raw
    .replace(/["'“”]/g, "")
    .replace(/\d+\s*\$?/g, "")
    .trim();
  const key = cleaned.toLowerCase();
  if (EMPLOYEE_ALIASES[key]) return EMPLOYEE_ALIASES[key];
  // Título simple: primera letra mayúscula de cada palabra
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// Categorías: heurística por palabra clave
// ---------------------------------------------------------------------------
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Motor": ["motor", "cabezote", "culata", "biela", "piston", "pistón", "block", "cigüeñal", "cigueñal", "correa", "distribucion", "distribución", "bomba de agua", "bomba de aceite", "inyector", "bujia", "bujía", "carburador", "refrigerante", "termostato", "canister", "admision", "admisión", "múltiple", "multiple", "flauta", "depurador", "electro", "radiador"],
  "Eléctrico": ["arnes", "arnés", "computadora", "fusible", "sensor", "modulo", "módulo", "switch", "swicht", "bateria", "batería", "alternador", "marcha", "foco", "luz", "luces", "radio", "bocina", "cable", "uch", "encendido", "llave", "cilindro"],
  "Suspensión": ["amortiguador", "resorte", "rotula", "rótula", "terminal", "mesa", "rodamiento", "maza", "muelle"],
  "Frenos": ["freno", "disco", "pastilla", "mordaza", "bombin", "bombín"],
  "Transmisión": ["caja de cambios", "embrague", "clutch", "diferencial", "cardan", "cardán", "palanca de cambios", "sincronico"],
  "Carrocería": ["guardachoque", "capot", "puerta", "guardafango", "parabrisas", "vidrio", "compuerta", "chasis", "faro", "espejo", "retrovisor", "costado", "chapa", "cerradura", "guardapolvo", "parachoque", "techo", "aro", "llanta", "neblinero", "parante", "visagra", "bisagra"],
  "Interior": ["tapiceria", "tapicería", "asiento", "alfombra", "consola", "tablero", "guantera", "cinturon", "cinturón", "cenicero", "palanca de freno de mano", "apoyabrazos", "moldura", "elevavidrio", "manija", "jaladera", "parlante", "visera", "portagafas", "portavasos", "volante"],
  "Escape": ["silenciador", "escape", "catalizador"],
};

function inferCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "Otro";
}

// ---------------------------------------------------------------------------
// Parseo del chat
// ---------------------------------------------------------------------------
type SaleRecord = {
  line: number;
  saleNumber: string;
  date: Date;
  rawText: string;
  description: string;
  price: number;
  employee: string;
  vehicleTag: string | null;
  groups: PartGroup[];
  pending: boolean;
  isFullVehicle: boolean;
  isScrap: boolean;
  skipReason?: string;
};

const WHATSAPP_HEADER = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}) - ([^:]+): (.*)$/;
const SALE_LINE = /^N(\d+)\b(.*)$/i;

function parseChat(text: string): SaleRecord[] {
  const lines = text.split(/\r?\n/);
  const records: SaleRecord[] = [];
  let currentDate: Date | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    let content = rawLine;

    const headerMatch = rawLine.match(WHATSAPP_HEADER);
    if (headerMatch) {
      const [, d, m, y, hh, mm] = headerMatch;
      currentDate = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
      content = headerMatch[7];
    }

    const numberedMatch = content.match(SALE_LINE);
    const chatarraMatch = content.match(/^(chatarras?\b.*)$/i);
    const saleMatch =
      numberedMatch ??
      (chatarraMatch ? ([chatarraMatch[0], "CH", chatarraMatch[1]] as unknown as RegExpMatchArray) : null);
    if (!saleMatch) continue;

    const isScrap = !numberedMatch;
    const saleNumber = saleMatch[1];
    let body = saleMatch[2].replace(/<[^>]*>/g, " ").trim();
    const date = currentDate ?? new Date(0);

    // Algunos mensajes traen un salto de línea interno (ej. el precio queda en la
    // línea siguiente); esa línea de continuación no tiene cabecera ni empieza con N<num>.
    if (!/\d\s*\$|recibe/i.test(body)) {
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.match(WHATSAPP_HEADER) && !/^N\d+\b/i.test(nextLine.trim()) && nextLine.trim()) {
        body += " " + nextLine.trim();
      }
    }

    if (/anulad/i.test(body)) {
      records.push({
        line: i + 1,
        saleNumber,
        date,
        rawText: rawLine,
        description: "",
        price: 0,
        employee: "",
        vehicleTag: null,
        groups: [],
        pending: false,
        isFullVehicle: false,
        isScrap: false,
        skipReason: "anulado",
      });
      continue;
    }

    // Extraer y remover grupos entre paréntesis
    let pending = false;
    let employeeRaw: string | null = null;
    const parenGroups: string[] = [];
    body = body.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
      parenGroups.push(inner.trim());
      return " ";
    });

    for (const group of parenGroups) {
      if (/inno/i.test(group)) continue; // ya removido del body, solo lo ignoramos
      if (/pendiente/i.test(group)) {
        pending = true;
        continue;
      }
      employeeRaw = group; // el último grupo no-inno / no-pendiente válido gana
    }

    // Precio: última ocurrencia de N$ o N,NN$ (o, si no hay símbolo $, un número justo antes de "recibe")
    const priceMatches = [...body.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*\$/g)];
    let price = 0;
    if (priceMatches.length > 0) {
      const last = priceMatches[priceMatches.length - 1];
      price = parseFloat(last[1].replace(",", "."));
      body = body.replace(last[0], " ");
    } else {
      const bareMatch = body.match(/(\d+(?:[.,]\d{1,2})?)\s*recibe/i);
      if (bareMatch) {
        price = parseFloat(bareMatch[1].replace(",", "."));
        body = body.replace(bareMatch[1], " ");
      }
    }

    // recibe [Esteban]
    body = body.replace(/recibe\s*(esteban)?/gi, " ");

    // Paréntesis "(inno ..." sin cerrar: se descarta hasta el final
    body = body.replace(/\(\s*inn[^)]*$/i, " ");

    // Grupos de piezas por auto: cada auto mencionado cierra el grupo de piezas que va antes
    const groups = splitGroups(body);
    const vehicleTag = groups.find((g) => g.vehicleTag)?.vehicleTag ?? null;
    const description = groups.map((g) => g.description).filter(Boolean).join(" + ");

    const isFullVehicle = /complet[oa]/i.test(saleMatch[2]);

    let skipReason: string | undefined;
    if (price === 0) skipReason = "sin precio detectado";
    else if (!description && parenGroups.every((g) => /inno/i.test(g))) {
      skipReason = "línea 100% de Inno Mundo";
    } else if (!description) {
      skipReason = "sin descripción tras limpieza";
    }

    records.push({
      line: i + 1,
      saleNumber,
      date,
      rawText: rawLine,
      description: description || "(venta sin descripción)",
      price,
      employee: employeeRaw ? normalizeEmployee(employeeRaw) : "Esteban",
      vehicleTag,
      groups: groups.filter((g) => g.description),
      pending,
      isFullVehicle,
      isScrap,
      skipReason,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Reporte / ejecución
// ---------------------------------------------------------------------------
async function main() {
  const chatText = fs.readFileSync(CHAT_PATH, "utf8");
  const all = parseChat(chatText);

  const voided = all.filter((r) => r.skipReason === "anulado");
  const skipped = all.filter((r) => r.skipReason && r.skipReason !== "anulado");
  const valid = all.filter((r) => !r.skipReason);

  const unmatchedVehicle = valid.filter((r) => !r.vehicleTag);
  const totalRevenue = valid.reduce((s, r) => s + r.price, 0);
  const byEmployee = new Map<string, { count: number; revenue: number }>();
  for (const r of valid) {
    const e = byEmployee.get(r.employee) ?? { count: 0, revenue: 0 };
    e.count++;
    e.revenue += r.price;
    byEmployee.set(r.employee, e);
  }
  const byVehicle = new Map<string, number>();
  for (const r of valid) {
    const key = r.vehicleTag ?? "(sin vehículo)";
    byVehicle.set(key, (byVehicle.get(key) ?? 0) + 1);
  }

  console.log("=== REPORTE DE MIGRACIÓN WHATSAPP -> MONEYCARS ===");
  console.log(`Total líneas 'N...' detectadas: ${all.length}`);
  console.log(`  Anuladas: ${voided.length}`);
  console.log(`  Omitidas (sin precio / 100% inno / vacías): ${skipped.length}`);
  console.log(`  Válidas para migrar: ${valid.length}`);
  console.log(`  Sin vehículo reconocido: ${unmatchedVehicle.length}`);
  console.log(`  Ventas de vehículo completo: ${valid.filter((r) => r.isFullVehicle).length}`);
  console.log(`  Marcadas como pago pendiente: ${valid.filter((r) => r.pending).length}`);
  console.log(`Ingreso total estimado: $${totalRevenue.toFixed(2)}`);
  console.log("\n-- Por empleado --");
  for (const [emp, stats] of [...byEmployee.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${emp}: ${stats.count} ventas, $${stats.revenue.toFixed(2)}`);
  }
  console.log("\n-- Vehículos usados (top 40) --");
  for (const [tag, count] of [...byVehicle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`  ${tag}: ${count}`);
  }

  console.log("\n-- Muestra de registros omitidos (hasta 20) --");
  for (const r of skipped.slice(0, 20)) {
    console.log(`  [línea ${r.line}] N${r.saleNumber} (${r.skipReason}): ${r.rawText.trim()}`);
  }

  console.log("\n-- Muestra de registros SIN vehículo reconocido (hasta 20) --");
  for (const r of unmatchedVehicle.slice(0, 20)) {
    console.log(`  [línea ${r.line}] N${r.saleNumber}: "${r.description}" $${r.price} (${r.employee})`);
  }

  console.log("\n-- Muestra de 15 registros válidos parseados --");
  for (const r of valid.slice(0, 15)) {
    console.log(
      `  [línea ${r.line}] N${r.saleNumber} ${r.date.toISOString().slice(0, 10)} | "${r.description}" | $${r.price} | ${r.vehicleTag ?? "?"} | ${r.employee}${r.pending ? " (PENDIENTE)" : ""}`,
    );
  }

  const multi = valid.filter((r) => r.groups.length >= 2);
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(multi, null, 1));
  console.log(`\nVentas con varios autos: ${multi.length}`);
  for (const r of multi.slice(0, 3)) {
    console.log(`  [línea ${r.line}] $${r.price}`);
    for (const g of r.groups) console.log(`     ${g.vehicleTag}: ${g.description}`);
  }

  if (REGROUP) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter });
    const cats = await prisma.category.findMany();
    const catIds = new Map(cats.map((c) => [c.name, c.id]));
    const otroId = catIds.get("Otro")!;
    let salesRegrouped = 0;
    let itemsCreated = 0;

    for (const r of multi) {
      const sale = await prisma.sale.findFirst({
        where: { notes: { contains: `(línea ${r.line})` } },
        include: { items: { include: { part: true } } },
      });
      if (!sale || sale.items.length !== 1) continue;

      const totalWeight = r.groups.reduce((s, g) => s + g.weight, 0);
      const cents = Math.round(r.price * 100);
      const shares = r.groups.map((g) => Math.floor((cents * g.weight) / totalWeight));
      shares[0] += cents - shares.reduce((a, b) => a + b, 0);

      const oldItem = sale.items[0];
      await prisma.saleItem.delete({ where: { id: oldItem.id } });
      await prisma.part.delete({ where: { id: oldItem.partId } });
      const left = await prisma.part.count({ where: { partTypeId: oldItem.part.partTypeId } });
      if (left === 0) await prisma.partType.delete({ where: { id: oldItem.part.partTypeId } });

      for (let gi = 0; gi < r.groups.length; gi++) {
        const g = r.groups[gi];
        const catName = inferCategory(g.description);
        const price = shares[gi] / 100;

        let vehicleId: string | undefined;
        if (g.vehicleTag) {
          const def = VEHICLES.find((v) => v.tag === g.vehicleTag)!;
          let vehicle = await prisma.sourceVehicle.findFirst({
            where: { brand: def.brand, model: def.model, notes: { contains: "Migrado desde historial de WhatsApp" } },
          });
          if (!vehicle) {
            vehicle = await prisma.sourceVehicle.create({
              data: {
                brand: def.brand,
                model: def.model,
                year: 2010,
                purchaseDate: r.date,
                purchaseCost: 0,
                status: "DISMANTLED",
                notes: "Migrado desde historial de WhatsApp. Año y costo de compra estimados — verificar.",
              },
            });
          }
          vehicleId = vehicle.id;
        }

        const pt = await prisma.partType.create({
          data: {
            name: g.description.slice(0, 250),
            categoryId: catIds.get(catName) ?? otroId,
            description: `Migrado de WhatsApp, línea ${r.line}: "${r.rawText.trim()}"`,
          },
        });
        const seq = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('part_sku_seq')`;
        const prefix = catName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X");
        const part = await prisma.part.create({
          data: {
            sku: `${prefix}-${seq[0].nextval.toString().padStart(6, "0")}`,
            partTypeId: pt.id,
            sourceVehicleId: vehicleId,
            condition: PartCondition.USED_GOOD,
            status: PartStatus.SOLD,
            cost: 0,
            price,
          },
        });
        await prisma.saleItem.create({ data: { saleId: sale.id, partId: part.id, priceSold: price } });
        itemsCreated++;
      }

      await prisma.sale.update({ where: { id: sale.id }, data: { totalAmount: r.price } });
      salesRegrouped++;
    }

    console.log({ salesRegrouped, itemsCreated });
    await prisma.$disconnect();
    return;
  }

  if (FIX) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter });
    const cats = await prisma.category.findMany();
    const catIds = new Map(cats.map((c) => [c.name, c.id]));
    if (!catIds.has("Chatarra")) {
      const c = await prisma.category.create({ data: { name: "Chatarra" } });
      catIds.set("Chatarra", c.id);
    }

    let vehiclesLinked = 0;
    let renamed = 0;
    let scrapCreated = 0;

    for (const r of valid) {
      const sale = await prisma.sale.findFirst({
        where: { notes: { contains: `(línea ${r.line})` } },
        include: { items: { include: { part: true } } },
      });

      if (!sale) {
        if (!r.isScrap) continue;
        const emp = await prisma.employee.upsert({
          where: { name: r.employee },
          update: {},
          create: { name: r.employee },
        });
        const pt = await prisma.partType.create({
          data: {
            name: r.description.slice(0, 250),
            categoryId: catIds.get("Chatarra")!,
            description: `Migrado de WhatsApp, línea ${r.line}: "${r.rawText.trim()}"`,
          },
        });
        const seq = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('part_sku_seq')`;
        const part = await prisma.part.create({
          data: {
            sku: `CHA-${seq[0].nextval.toString().padStart(6, "0")}`,
            partTypeId: pt.id,
            condition: PartCondition.FOR_PARTS,
            status: PartStatus.SOLD,
            cost: 0,
            price: r.price,
          },
        });
        await prisma.sale.create({
          data: {
            employeeId: emp.id,
            saleDate: r.date,
            totalAmount: r.price,
            notes: `Migrado de WhatsApp chatarra (línea ${r.line})`,
            items: { create: [{ partId: part.id, priceSold: r.price }] },
          },
        });
        scrapCreated++;
        continue;
      }

      const part = sale.items[0]?.part;
      if (!part) continue;

      if (r.vehicleTag && !part.sourceVehicleId) {
        const def = VEHICLES.find((v) => v.tag === r.vehicleTag)!;
        let vehicle = await prisma.sourceVehicle.findFirst({
          where: {
            brand: def.brand,
            model: def.model,
            notes: { contains: "Migrado desde historial de WhatsApp" },
          },
        });
        if (!vehicle) {
          vehicle = await prisma.sourceVehicle.create({
            data: {
              brand: def.brand,
              model: def.model,
              year: 2010,
              purchaseDate: r.date,
              purchaseCost: 0,
              status: "DISMANTLED",
              notes: "Migrado desde historial de WhatsApp. Año y costo de compra estimados — verificar.",
            },
          });
        }
        await prisma.part.update({ where: { id: part.id }, data: { sourceVehicleId: vehicle.id } });
        vehiclesLinked++;
      }

      const pt = await prisma.partType.findUnique({ where: { id: part.partTypeId } });
      const cleanName = r.description.slice(0, 250);
      if (pt && pt.name !== cleanName) {
        await prisma.partType.update({ where: { id: pt.id }, data: { name: cleanName } });
        renamed++;
      }
    }

    console.log({ vehiclesLinked, renamed, scrapCreated });
    await prisma.$disconnect();
    return;
  }

  if (!COMMIT) {
    console.log("\n(dry-run: no se escribió nada en la base de datos. Usa --commit para migrar.)");
    return;
  }

  // -------------------------------------------------------------------------
  // Escritura real
  // -------------------------------------------------------------------------
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log("\nEscribiendo en la base de datos...");

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  // Vehículos: uno por tag usado, con fecha de compra = primera venta que lo menciona
  const vehicleFirstDate = new Map<string, Date>();
  for (const r of valid) {
    if (!r.vehicleTag) continue;
    const existing = vehicleFirstDate.get(r.vehicleTag);
    if (!existing || r.date < existing) vehicleFirstDate.set(r.vehicleTag, r.date);
  }

  const vehicleIdByTag = new Map<string, string>();
  for (const [tag, firstDate] of vehicleFirstDate) {
    const def = VEHICLES.find((v) => v.tag === tag)!;
    const created = await prisma.sourceVehicle.create({
      data: {
        brand: def.brand,
        model: def.model,
        year: 2010,
        purchaseDate: firstDate,
        purchaseCost: 0,
        status: "DISMANTLED",
        notes: "Migrado desde historial de WhatsApp. Año y costo de compra estimados — verificar.",
      },
    });
    vehicleIdByTag.set(tag, created.id);
  }
  console.log(`Vehículos creados: ${vehicleIdByTag.size}`);

  // Empleados
  const employeeNames = [...new Set(valid.map((r) => r.employee))];
  const employeeIdByName = new Map<string, string>();
  for (const name of employeeNames) {
    const emp = await prisma.employee.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    employeeIdByName.set(name, emp.id);
  }
  console.log(`Empleados creados/asegurados: ${employeeIdByName.size}`);

  // Ventas + piezas
  let created = 0;
  for (const r of valid) {
    const categoryName = r.isScrap ? "Chatarra" : inferCategory(r.description);
    const categoryId = categoryByName.get(categoryName) ?? categoryByName.get("Otro")!;

    const partType = await prisma.partType.create({
      data: {
        name: r.description.slice(0, 250),
        categoryId,
        description: `Migrado de WhatsApp, línea ${r.line}: "${r.rawText.trim()}"`,
      },
    });

    const skuPrefix = categoryName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X");
    const seqRow = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('part_sku_seq')`;
    const sku = `${skuPrefix}-${seqRow[0].nextval.toString().padStart(6, "0")}`;

    const sourceVehicleId = r.vehicleTag ? vehicleIdByTag.get(r.vehicleTag) : undefined;

    const part = await prisma.part.create({
      data: {
        sku,
        partTypeId: partType.id,
        sourceVehicleId,
        condition: PartCondition.USED_GOOD,
        status: PartStatus.SOLD,
        cost: 0,
        price: r.price,
        notes: r.pending ? "Pago pendiente según registro de WhatsApp." : null,
      },
    });

    await prisma.sale.create({
      data: {
        employeeId: employeeIdByName.get(r.employee),
        saleDate: r.date,
        totalAmount: r.price,
        notes: `Migrado de WhatsApp N${r.saleNumber} (línea ${r.line})${r.pending ? " — PAGO PENDIENTE" : ""}`,
        items: {
          create: [{ partId: part.id, priceSold: r.price }],
        },
      },
    });

    created++;
    if (created % 100 === 0) console.log(`  ${created}/${valid.length}...`);
  }

  console.log(`\nListo. ${created} ventas migradas.`);
  await prisma.$disconnect();
}

export { parseChat, VEHICLES, CHAT_PATH };

if (!process.env.NO_MAIN) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
