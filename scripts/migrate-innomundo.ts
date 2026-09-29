/**
 * Migración de ventas históricas desde el chat de WhatsApp "Innomundo Repuestos".
 *
 * Uso:
 *   npx tsx scripts/migrate-innomundo.ts            -> modo dry-run (solo reporte)
 *   npx tsx scripts/migrate-innomundo.ts --commit    -> inserta en la base de datos
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PartCondition, PartStatus } from "../src/generated/prisma/enums";
import { inferCategory } from "../src/lib/categorize";
import { stripAccents } from "../src/lib/part-matcher";

const CHAT_PATH = "C:\\Users\\anghe\\AppData\\Local\\Temp\\Chat de WhatsApp con Innomundo Repuestos .txt";

const COMMIT = process.argv.includes("--commit");

// ---------------------------------------------------------------------------
// Vehículos: en este chat no hay numeración de instancia (SPARK1, SPARK2...);
// Esteban distingue autos del mismo modelo por color/variante en el propio texto
// ("Spark negro", "Spark plomo", "Corsa wind verde"). Por eso el tag combina
// modelo + variante detectada, en vez de una lista fija de instancias.
// ---------------------------------------------------------------------------
type VehicleDef = { tag: string; brand: string; model: string; aliases: string[] };

const VEHICLES: VehicleDef[] = [
  { tag: "LOGAN", brand: "Renault", model: "Logan", aliases: ["logan"] },
  { tag: "SANDERO", brand: "Renault", model: "Sandero", aliases: ["sandero"] },
  { tag: "MEGANE", brand: "Renault", model: "Mégane", aliases: ["megane"] },
  { tag: "SPARK", brand: "Chevrolet", model: "Spark", aliases: ["spark"] },
  { tag: "OPTRA", brand: "Chevrolet", model: "Optra", aliases: ["optra"] },
  {
    tag: "CORSA",
    brand: "Chevrolet",
    model: "Corsa",
    aliases: ["corsa evolution", "corsa evo", "corsa wind", "corsa win", "corsa"],
  },
  { tag: "AVEO", brand: "Chevrolet", model: "Aveo", aliases: ["aveo family", "aveo emotion", "aveo"] },
  { tag: "DMAX", brand: "Chevrolet", model: "D-Max", aliases: ["d-max", "dmax"] },
  { tag: "MATIZ", brand: "Chevrolet", model: "Matiz", aliases: ["matiz"] },
  { tag: "COROLLA", brand: "Toyota", model: "Corolla", aliases: ["corolla"] },
  { tag: "YARIS", brand: "Toyota", model: "Yaris", aliases: ["yaris"] },
  { tag: "HILUX", brand: "Toyota", model: "Hilux", aliases: ["hilux"] },
  {
    tag: "XTRAIL",
    brand: "Nissan",
    model: "X-Trail",
    aliases: ["x-trail xtreme", "xtrail xtreme", "x-trail", "xtrail"],
  },
  { tag: "VERSA", brand: "Nissan", model: "Versa", aliases: ["versa"] },
  { tag: "MARCH", brand: "Nissan", model: "March", aliases: ["march"] },
  { tag: "TIIDA", brand: "Nissan", model: "Tiida", aliases: ["tiida", "tiiida"] },
  { tag: "SENTRA", brand: "Nissan", model: "Sentra", aliases: ["sentra"] },
  { tag: "GOLF", brand: "Volkswagen", model: "Golf", aliases: ["golf"] },
  { tag: "POLO", brand: "Volkswagen", model: "Polo", aliases: ["polo"] },
  { tag: "ELANTRA", brand: "Hyundai", model: "Elantra", aliases: ["elantra"] },
  { tag: "ACCENT", brand: "Hyundai", model: "Accent", aliases: ["accent"] },
  { tag: "TERRACAN", brand: "Hyundai", model: "Terracan", aliases: ["terracan"] },
  { tag: "TUCSON", brand: "Hyundai", model: "Tucson", aliases: ["tucson"] },
  { tag: "SANTAFE", brand: "Hyundai", model: "Santa Fe", aliases: ["santa fe", "santafe"] },
  { tag: "GRANDI10", brand: "Hyundai", model: "Grand i10", aliases: ["grand i10", "grandi10"] },
  { tag: "CHEROKEE", brand: "Jeep", model: "Cherokee", aliases: ["grand cherokee", "cherokee"] },
  { tag: "JEEP", brand: "Jeep", model: "(genérico)", aliases: ["jeep"] },
  { tag: "MAZDA", brand: "Mazda", model: "3/5/6", aliases: ["mazda 3", "mazda3", "mazda 5", "mazda5", "mazda 6", "mazda6", "mazda"] },
  { tag: "VITARA", brand: "Suzuki", model: "Vitara", aliases: ["gran vitara", "grand vitara", "vitara 3p", "vitara"] },
  { tag: "SWIFT", brand: "Suzuki", model: "Swift", aliases: ["swift"] },
  { tag: "FESTIVA", brand: "Ford", model: "Festiva", aliases: ["festiva"] },
  { tag: "FIESTA", brand: "Ford", model: "Fiesta", aliases: ["fiesta"] },
  { tag: "ECOSPORT", brand: "Ford", model: "EcoSport", aliases: ["ecosport"] },
  { tag: "RANGER", brand: "Ford", model: "Ranger", aliases: ["ranger"] },
  { tag: "PICANTO", brand: "Kia", model: "Picanto", aliases: ["picanto"] },
  { tag: "SPORTAGE", brand: "Kia", model: "Sportage", aliases: ["sportage"] },
  { tag: "CERATO", brand: "Kia", model: "Cerato", aliases: ["cerato"] },
  { tag: "ZOYTE", brand: "Desconocido", model: "Zoyte", aliases: ["zoyte"] },
];

const ALIAS_LOOKUP = VEHICLES.flatMap((v) => v.aliases.map((a) => ({ alias: a, vehicle: v }))).sort(
  (a, b) => b.alias.length - a.alias.length,
);

const VARIANT_WORDS = [
  "negro", "negra", "plomo", "blanco", "blanca", "rojo", "roja", "azul", "verde", "dorado", "dorada",
  "naranja", "crema", "gris", "vino", "beige", "amarillo", "celeste", "cielo", "morado", "plata",
  "wind", "win", "evo", "evolution", "mono", "hatchback", "life", "family", "emotion", "xtreme", "taxi",
];

function aliasPattern(alias: string): RegExp {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function findVehicleTag(text: string): { tag: string; brand: string; model: string } | null {
  const normalized = stripAccents(text.toLowerCase());
  for (const { alias, vehicle } of ALIAS_LOOKUP) {
    const re = aliasPattern(alias);
    const m = re.exec(normalized);
    if (!m) continue;

    // Busca palabras de variante/color en todo el fragmento, en el orden en que aparecen en el texto
    const found: { word: string; index: number }[] = [];
    for (const w of VARIANT_WORDS) {
      const vm = new RegExp(`\\b${w}\\b`, "i").exec(normalized);
      if (vm) found.push({ word: w, index: vm.index });
    }
    found.sort((a, b) => a.index - b.index);
    const variants = [...new Set(found.map((f) => f.word))];
    const tag = variants.length ? `${vehicle.tag}_${variants.join("_").toUpperCase()}` : vehicle.tag;
    return { tag, brand: vehicle.brand, model: vehicle.model };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Empleados / receptores de pago
// ---------------------------------------------------------------------------
const EMPLOYEE_ALIASES: Record<string, string> = {
  esteban: "Esteban",
  mateo: "Mateo",
  carlos: "Carlos Albán",
  carlosalban: "Carlos Albán",
  carlitosalban: "Carlos Albán",
  conta: "Contá",
  alejo: "Contá",
  contaalejo: "Contá",
  andy: "Andy",
  andi: "Andy",
  diego: "Diego",
  // Personal compartido con MoneyCars que también vende/recibe para Innomundo
  // (aparece como "recibe Esteban (Martin)", igual que en el chat de MoneyCars).
  martin: "Martin",
  daniela: "Daniela",
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
  jose: "José",
  keila: "Keila",
  diana: "Diana",
  sofia: "Sofia",
  melissa: "Melissa",
  melisa: "Melissa",
  nando: "Nando",
};

function normalizeRecipient(raw: string): string | null {
  const key = stripAccents(raw.toLowerCase()).replace(/\s+/g, "");
  return EMPLOYEE_ALIASES[key] ?? null;
}

// ---------------------------------------------------------------------------
// Parseo del chat
// ---------------------------------------------------------------------------
type SaleRecord = {
  line: number;
  saleNumber: string; // "" si no tenía número N#### en el chat
  date: Date;
  rawText: string;
  description: string;
  price: number;
  employee: string;
  vehicleTag: string | null;
  pending: boolean;
  isFullVehicle: boolean;
  isScrap: boolean;
  skipReason?: string;
};

const WHATSAPP_HEADER = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}) - ([^:]+): (.*)$/;
// El número "N####" en este chat aparece de formas muy variadas: al inicio ("N109 ..."),
// entre paréntesis en medio de la línea ("(N103) ..."), como mensaje propio suelto ("N101"),
// o después de la descripción ("... 40$ recibe Esteban" seguido de "(N107)" aparte). No sirve
// como ancla fija de "esto es una venta": se usa solo para extraer el número si aparece, y como
// señal auxiliar para el precio de respaldo (sin "$") cuando la línea ya trae un número de venta.
// Requiere que la "N" no sea la cola de otra palabra (evita falsos positivos como
// "calefacción 60$", donde "...ción 60" no debe leerse como una etiqueta "N60").
const N_LABEL = /(?<![a-záéíóúñA-ZÁÉÍÓÚÑ])N\s?(\d+)\)?\*?/i;
const SYSTEM_MSG =
  /archivo adjunto\)\s*$|Eliminaste este mensaje|Se elimin[oó] este mensaje|cifrados de extremo|Creaste este grupo|A[ñn]adiste a|cambiaste el ícono|cambió el asunto|Enviado desde mi nueva Banca/i;

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

    if (SYSTEM_MSG.test(content)) continue;
    if (!content.trim()) continue;

    const labelMatch = content.match(N_LABEL);
    const hasPrice = /\d+(?:[.,]\d{1,2})?\s*\$/.test(content);
    if (!labelMatch && !hasPrice) continue; // charla normal, no es una venta

    const date = currentDate ?? new Date(0);
    let body = content.replace(/<[^>]*>/g, " ").trim();
    const saleNumber = labelMatch ? labelMatch[1] : "";
    body = body.replace(new RegExp(N_LABEL.source, "i"), " ");

    // Continuación: si la línea no trae precio ni "recibe", intenta con la siguiente línea suelta.
    if (!/\d\s*\$|recib/i.test(body)) {
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.match(WHATSAPP_HEADER) && !N_LABEL.test(nextLine.trim()) && nextLine.trim()) {
        body += " " + nextLine.trim();
      }
    }

    if (/anulad/i.test(body)) {
      records.push({
        line: i + 1, saleNumber, date, rawText: rawLine, description: "", price: 0, employee: "",
        vehicleTag: null, pending: false, isFullVehicle: false, isScrap: false, skipReason: "anulado",
      });
      continue;
    }
    if (/regresa\s+al\s+inventario/i.test(body)) {
      records.push({
        line: i + 1, saleNumber, date, rawText: rawLine, description: "", price: 0, employee: "",
        vehicleTag: null, pending: false, isFullVehicle: false, isScrap: false, skipReason: "devolución al inventario",
      });
      continue;
    }

    if (/^\s*(gran\s+)?total\b/i.test(body.replace(/\d+(?:[.,]\d{1,2})?\s*\$/g, "").trim())) {
      records.push({
        line: i + 1, saleNumber, date, rawText: rawLine, description: "", price: 0, employee: "",
        vehicleTag: null, pending: false, isFullVehicle: false, isScrap: false, skipReason: "línea de recap ('total'), no es una venta nueva",
      });
      continue;
    }

    const pending = /pendiente/i.test(body);
    body = body.replace(/pendiente(\s+por\s+cobro(\s+con\s+tarjeta)?)?/gi, " ");
    body = body.replace(/\b(asignad[oa]s?|asignamos|asignando)\s+a\s+innomundo\s+automotriz\b/gi, " ");

    // Precio: última ocurrencia de N$ (o N $, con o sin decimales)
    const priceMatches = [...body.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*\$/g)];
    let price = 0;
    if (priceMatches.length > 0) {
      const last = priceMatches[priceMatches.length - 1];
      price = parseFloat(last[1].replace(",", "."));
      body = body.slice(0, last.index) + " " + body.slice((last.index ?? 0) + last[0].length);
    } else if (saleNumber) {
      // Sin signo "$" (typo ocasional), pero la línea sí trae un número de venta: acepta un
      // número suelto pegado a "recibe" en cualquiera de los dos órdenes.
      const bare =
        body.match(/(\d+(?:[.,]\d{1,2})?)\s*recib/i) ?? body.match(/recib[a-záéíóúñ]*\s+(\d+(?:[.,]\d{1,2})?)\b/i);
      if (bare) {
        price = parseFloat(bare[1].replace(",", "."));
        body = body.replace(bare[0], " ");
      }
    }

    // Receptor del pago: última mención "recibe/recibí/recibimos <nombre> (<nombre2>)" reconocida.
    // El nombre entre paréntesis (si lo hay, como en el chat de MoneyCars) es quien realmente
    // vendió y manda sobre el nombre principal ("recibe Esteban (Martin)" -> Martin).
    const recibeMatches = [
      ...body.matchAll(/recib[eíí]?[a-z]*\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)(?:\s*\(([a-záéíóúñ]+)\))?/gi),
    ];
    let employee = "Esteban";
    for (const m of recibeMatches) {
      const primary = normalizeRecipient(m[1]);
      const override = m[2] ? normalizeRecipient(m[2]) : null;
      const chosen = override ?? primary;
      if (chosen) employee = chosen;
    }
    body = body.replace(/recib[eíí]?[a-z]*\s+[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?(?:\s*\([a-záéíóúñ]+\))?/gi, " ");
    body = body.replace(/\b(en\s+)?(efectivo|transferencia)\b/gi, " ");
    body = body.replace(/[()]/g, " ");
    body = body.replace(/\s{2,}/g, " ").replace(/^[\s,.\-+]+|[\s,.\-+]+$/g, "").trim();

    const isFullVehicle = /\bcompletos?\b|\bvehiculo completo\b/i.test(body);
    const isScrap = /^\s*(chatarras?)\b/i.test(body);

    const match = findVehicleTag(body);

    let skipReason: string | undefined;
    if (price === 0) skipReason = "sin precio detectado";

    records.push({
      line: i + 1,
      saleNumber,
      date,
      rawText: rawLine,
      description: body || "(venta sin descripción)",
      price,
      employee,
      vehicleTag: match?.tag ?? null,
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
  const returned = all.filter((r) => r.skipReason === "devolución al inventario");
  const skipped = all.filter((r) => r.skipReason && r.skipReason !== "anulado" && r.skipReason !== "devolución al inventario");
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

  console.log("=== REPORTE DE MIGRACIÓN WHATSAPP -> INNOMUNDO ===");
  console.log(`Total líneas detectadas como venta: ${all.length}`);
  console.log(`  Anuladas: ${voided.length}`);
  console.log(`  Devoluciones al inventario (no es venta): ${returned.length}`);
  console.log(`  Omitidas (sin precio / sin descripción): ${skipped.length}`);
  console.log(`  Válidas para migrar: ${valid.length}`);
  console.log(`  Sin vehículo reconocido: ${unmatchedVehicle.length} (${((unmatchedVehicle.length / valid.length) * 100).toFixed(1)}%)`);
  console.log(`  Marcadas como pago pendiente: ${valid.filter((r) => r.pending).length}`);
  console.log(`Ingreso total estimado: $${totalRevenue.toFixed(2)}`);
  console.log("\n-- Por receptor de pago --");
  for (const [emp, stats] of [...byEmployee.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${emp}: ${stats.count} ventas, $${stats.revenue.toFixed(2)}`);
  }
  console.log("\n-- Vehículos detectados (top 40) --");
  for (const [tag, count] of [...byVehicle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) {
    console.log(`  ${tag}: ${count}`);
  }

  console.log("\n-- Muestra de registros omitidos (hasta 20) --");
  for (const r of skipped.slice(0, 20)) {
    console.log(`  [línea ${r.line}] N${r.saleNumber || "?"} (${r.skipReason}): ${r.rawText.trim()}`);
  }

  console.log("\n-- Muestra de registros SIN vehículo reconocido (hasta 25) --");
  for (const r of unmatchedVehicle.slice(0, 25)) {
    console.log(`  [línea ${r.line}] "${r.description}" $${r.price} (${r.employee})`);
  }

  console.log("\n-- Muestra de 20 registros válidos parseados --");
  for (const r of valid.slice(0, 10).concat(valid.slice(-10))) {
    console.log(
      `  [línea ${r.line}] N${r.saleNumber || "?"} ${r.date.toISOString().slice(0, 10)} | "${r.description}" | $${r.price} | ${r.vehicleTag ?? "?"} | ${r.employee}${r.pending ? " (PENDIENTE)" : ""}`,
    );
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
  const chatarraId = categoryByName.get("Chatarra");

  // Vehículos: uno por tag usado, con fecha de compra = primera venta que lo menciona
  const vehicleFirstDate = new Map<string, Date>();
  for (const r of valid) {
    if (!r.vehicleTag) continue;
    const existing = vehicleFirstDate.get(r.vehicleTag);
    if (!existing || r.date < existing) vehicleFirstDate.set(r.vehicleTag, r.date);
  }

  const vehicleIdByTag = new Map<string, string>();
  for (const [tag, firstDate] of vehicleFirstDate) {
    const baseTag = tag.split("_")[0];
    const def = VEHICLES.find((v) => v.tag === baseTag)!;
    const created = await prisma.sourceVehicle.create({
      data: {
        business: "INNOMUNDO",
        brand: def.brand,
        model: def.model,
        year: 2010,
        purchaseDate: firstDate,
        purchaseCost: 0,
        status: "DISMANTLED",
        notes: `Migrado desde historial de WhatsApp (Innomundo), variante detectada: ${tag}. Año y costo de compra estimados — verificar.`,
      },
    });
    vehicleIdByTag.set(tag, created.id);
  }
  console.log(`Vehículos creados: ${vehicleIdByTag.size}`);

  // Empleados
  const employeeNames = [...new Set(valid.map((r) => r.employee))];
  const employeeIdByName = new Map<string, string>();
  for (const name of employeeNames) {
    const emp = await prisma.employee.upsert({ where: { name }, update: {}, create: { name } });
    employeeIdByName.set(name, emp.id);
  }
  console.log(`Empleados creados/asegurados: ${employeeIdByName.size}`);

  // Ventas + piezas
  let created = 0;
  for (const r of valid) {
    const categoryName = r.isScrap ? "Chatarra" : inferCategory(r.description);
    const categoryId = (r.isScrap ? chatarraId : categoryByName.get(categoryName)) ?? categoryByName.get("Otro")!;

    const partType = await prisma.partType.create({
      data: {
        business: "INNOMUNDO",
        name: r.description.slice(0, 250),
        categoryId,
        description: `Migrado de WhatsApp Innomundo, línea ${r.line}: "${r.rawText.trim()}"`,
      },
    });

    const skuPrefix = categoryName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X");
    const seqRow = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('part_sku_seq')`;
    const sku = `${skuPrefix}-${seqRow[0].nextval.toString().padStart(6, "0")}`;

    const sourceVehicleId = r.vehicleTag ? vehicleIdByTag.get(r.vehicleTag) : undefined;

    const part = await prisma.part.create({
      data: {
        business: "INNOMUNDO",
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
        business: "INNOMUNDO",
        employeeId: employeeIdByName.get(r.employee),
        saleDate: r.date,
        totalAmount: r.price,
        notes: `Migrado de WhatsApp Innomundo ${r.saleNumber ? `N${r.saleNumber}` : ""} (línea ${r.line})${r.pending ? " — PAGO PENDIENTE" : ""}`,
        items: { create: [{ partId: part.id, priceSold: r.price }] },
      },
    });

    created++;
    if (created % 200 === 0) console.log(`  ${created}/${valid.length}...`);
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
