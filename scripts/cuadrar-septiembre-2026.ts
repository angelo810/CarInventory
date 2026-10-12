/**
 * Cuadra septiembre 2026 contra los chats en PDF (MoneyCars e Innomundo):
 *  - agrega las ventas que faltan,
 *  - corrige el precio por pieza de las ya registradas con el detalle en negrilla,
 *  - ajusta quién vendió en las piezas de Innomundo que se anotaron en el chat de MoneyCars.
 *
 *   npx tsx scripts/cuadrar-septiembre-2026.ts            -> simulación (no escribe)
 *   npx tsx scripts/cuadrar-septiembre-2026.ts --commit   -> aplica
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildCatalog, matchPiece, type CatalogEntry } from "../src/lib/part-matcher";
import { categoryCode } from "../src/lib/sku";
import { inferCategory } from "../src/lib/categorize";

const COMMIT = process.argv.includes("--commit");
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SOLD_AS = "Vendida como: ";
type Business = "MONEYCARS" | "INNOMUNDO";

// catalog: fuerza el nombre exacto del catálogo; free: no emparejar (queda en "Revisar coincidencias").
type Item = { text: string; price: number; catalog?: string; free?: boolean };
type NewSale = {
  n: string; // número de venta del chat
  business: Business;
  date: Date;
  employee: string;
  vehicle: string; // model de SourceVehicle (MoneyCars) o clave de variante (Innomundo)
  items: Item[];
};

const d = (day: number, h: number, m: number, s: number) => new Date(2026, 8, day, h, m, s);

// ---------------------------------------------------------------------------
// MoneyCars: ventas del chat que no estaban registradas (solo la parte de MoneyCars;
// lo que va entre "(inno ...)" es de Innomundo y no se cuenta aquí).
// ---------------------------------------------------------------------------
const MC_NEW: NewSale[] = [
  {
    n: "N1388", business: "MONEYCARS", date: d(8, 18, 1, 0), employee: "Ale", vehicle: "Corsa Evolution 4",
    items: [
      { text: "cola carrocería", price: 400, free: true },
      { text: "compuerta", price: 200 },
      { text: "parabrisas posterior", price: 70 },
    ],
  },
  {
    n: "N1425", business: "MONEYCARS", date: d(21, 17, 36, 48), employee: "Esteban", vehicle: "Polo",
    items: [
      { text: "tapa gasolina carrocería", price: 40 },
      { text: "puerta posterior derecha", price: 140 },
      { text: "vidrio posterior derecha", price: 25 },
      { text: "manija posterior derecho", price: 5, catalog: "Manija puerta posterior RH" },
      { text: "moldura puerta pósterior derecha", price: 15 },
      { text: "moldura puertas vidrios posterior derecha", price: 5, catalog: "Molduras contorno vidrios RH" },
      { text: "moldura puertas vidrios posterior derecha", price: 5, catalog: "Molduras contorno vidrios RH" },
      { text: "araña delantera Lh", price: 30 },
      { text: "base motor carrocería RH", price: 10 },
      { text: "ventolera posterior RH", price: 25 },
    ],
  },
  { n: "N1426", business: "MONEYCARS", date: d(22, 17, 41, 8), employee: "Esteban", vehicle: "Corsa Evolution 1", items: [{ text: "tapas distribución", price: 30 }] },
  { n: "N1427", business: "MONEYCARS", date: d(22, 17, 42, 2), employee: "Stiven", vehicle: "Spark 3", items: [{ text: "arnes de luces", price: 40 }] },
  {
    n: "N1429", business: "MONEYCARS", date: d(22, 17, 44, 21), employee: "Esteban", vehicle: "X-Trail T30",
    items: [
      { text: "guardapolvo posterior súperior", price: 10 },
      { text: "guardapolvo tubo de gasolina", price: 5 },
    ],
  },
  { n: "N1431", business: "MONEYCARS", date: d(23, 17, 54, 3), employee: "Esteban", vehicle: "Spark 2", items: [{ text: "tapón moldura tablero", price: 5, free: true }] },
  {
    n: "N1432", business: "MONEYCARS", date: d(23, 17, 55, 56), employee: "Ale", vehicle: "Corsa Evolution 4",
    items: [
      { text: "faro delantero lh", price: 50 },
      { text: "faro delantero rh", price: 50 },
    ],
  },
  { n: "N1433", business: "MONEYCARS", date: d(23, 17, 57, 15), employee: "Martin", vehicle: "Corsa Evolution 4", items: [{ text: "perno cigüeñal", price: 12, free: true }] },
  { n: "N1434", business: "MONEYCARS", date: d(23, 17, 59, 19), employee: "Esteban", vehicle: "X-Trail T30", items: [{ text: "pisadera posterior RH", price: 60 }] },
  {
    n: "N1430", business: "MONEYCARS", date: d(24, 17, 34, 44), employee: "Stiven", vehicle: "Spark 4",
    items: [
      { text: "carrocería en lata", price: 900 },
      { text: "puerta delantera RH armada", price: 300 },
      { text: "soporte guardachoque delantero", price: 50 },
      { text: "soporte tablero", price: 50, free: true },
    ],
  },
  { n: "N1436", business: "MONEYCARS", date: d(24, 17, 36, 51), employee: "Esteban", vehicle: "Optra 5", items: [{ text: "manija interna delantera Lh", price: 30, catalog: "Manija interna puerta delantera LH" }] },
  {
    n: "N1437", business: "MONEYCARS", date: d(24, 17, 39, 10), employee: "Melissa", vehicle: "Logan 3",
    items: [
      { text: "boton de stop", price: 20 },
      { text: "botón de vidrio delantero RH", price: 20, catalog: "Botón Elevavidrios" },
      { text: "botón vidrio delantero Lh", price: 20, catalog: "Botón Elevavidrios" },
      { text: "botón seguros", price: 20 },
      { text: "botón desempañador trasero", price: 20 },
    ],
  },
  { n: "N1437", business: "MONEYCARS", date: d(24, 17, 39, 10), employee: "Melissa", vehicle: "Sandero", items: [{ text: "5 sockets de botones tablero", price: 40 }] },
  { n: "N1438", business: "MONEYCARS", date: d(24, 17, 40, 33), employee: "Stiven", vehicle: "Spark 4", items: [{ text: "guardáfango delantero RH", price: 45 }] },
  { n: "N1439", business: "MONEYCARS", date: d(24, 17, 42, 0), employee: "Esteban", vehicle: "Corolla 2", items: [{ text: "bisagra capot RH", price: 30, free: true }] },
  {
    n: "N1439", business: "MONEYCARS", date: d(24, 17, 42, 0), employee: "Esteban", vehicle: "Corolla 4",
    items: [
      { text: "manguera de aire acondicionado retorno", price: 55 },
      { text: "manguera aire acondicionado salida", price: 50 },
    ],
  },
  { n: "N1440", business: "MONEYCARS", date: d(24, 17, 43, 7), employee: "Esteban", vehicle: "Spark 3", items: [{ text: "modulo alarma", price: 50 }] },
  { n: "N1441", business: "MONEYCARS", date: d(25, 17, 9, 0), employee: "Stiven", vehicle: "Sandero", items: [{ text: "moldura freno de mano", price: 50, free: true }] },
  {
    n: "N1442", business: "MONEYCARS", date: d(25, 17, 12, 7), employee: "Esteban", vehicle: "Spark 2",
    items: [
      { text: "tapiceria posteriores LH", price: 30, catalog: "Tapiceria puerta posterior LH" },
      { text: "tapicería posterior RH", price: 30, catalog: "Tapiceria puerta posterior RH" },
    ],
  },
  {
    n: "N1443", business: "MONEYCARS", date: d(26, 13, 26, 23), employee: "Ale", vehicle: "X-Trail T30",
    items: [
      { text: "eje delantero Lh", price: 170 },
      { text: "mesa delantera Lh", price: 35 },
      { text: "amortiguador delantero Lh", price: 25 },
      { text: "base amortiguador delantero Lh", price: 10, free: true },
      { text: "espiral delantero Lh", price: 60 },
    ],
  },
  { n: "N1445", business: "MONEYCARS", date: d(28, 17, 51, 9), employee: "Esteban", vehicle: "Spark 4", items: [{ text: "logo Chevrolet", price: 10 }] },
  { n: "N1446", business: "MONEYCARS", date: d(28, 17, 52, 6), employee: "Sofia", vehicle: "Corsa Evolution 3", items: [{ text: "biela", price: 35 }] },
  { n: "N1448", business: "MONEYCARS", date: d(29, 17, 45, 10), employee: "Stiven", vehicle: "Yaris", items: [{ text: "pedal de embrague", price: 40 }] },
  { n: "N1449", business: "MONEYCARS", date: d(30, 17, 45, 20), employee: "Stiven", vehicle: "Logan 1", items: [{ text: "tapa distribución", price: 35 }] },
];

// ---------------------------------------------------------------------------
// MoneyCars: ventas ya registradas cuyo precio por pieza estaba repartido en partes iguales;
// el chat trae el precio exacto de cada una en negrilla.
// ---------------------------------------------------------------------------
type Fix = { n: string; marker: string; byVehicle: Record<string, Item[]> };
const MC_FIX: Fix[] = [
  { n: "N1398", marker: "N1398 (línea", byVehicle: { "Optra 2": [{ text: "disco de embrague", price: 10 }, { text: "plato de embrague", price: 20 }] } },
  { n: "N1401", marker: "N1401 (línea", byVehicle: { "Spark 4": [{ text: "rejillas de ac", price: 18 }, { text: "moldura interna retrovisor RH", price: 12 }] } },
  {
    n: "N1412", marker: "N1412 (línea",
    byVehicle: { "X-Trail T30": [{ text: "plástico tablero inferior RH", price: 30 }, { text: "varrilla aceite", price: 25 }, { text: "cinta airbag", price: 25 }] },
  },
  {
    n: "N1415", marker: "N1415 (línea",
    byVehicle: {
      "Optra 4": [{ text: "moldura de techo LH", price: 30 }],
      "Optra 2": [{ text: "ventolera posterior LH", price: 30 }, { text: "brazo de pluma Lh", price: 40 }],
    },
  },
  {
    n: "N1423", marker: "N1423 (línea",
    byVehicle: {
      "X-Trail T30": [
        { text: "fusiblera", price: 200 },
        { text: "fusiblera", price: 200 },
        { text: "soporte guardachoque delantero", price: 80 },
        { text: "soporte guardachoque delantero", price: 80 },
        { text: "tubo de refrigerante", price: 40 },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Innomundo
// ---------------------------------------------------------------------------
const INNO_NEW: NewSale[] = [
  { n: "N1447", business: "INNOMUNDO", date: d(28, 17, 58, 45), employee: "Martin", vehicle: "OPTRA_MONO", items: [{ text: "cruceta de dirección", price: 45 }] },
];
// Quién vendió, según el "(Nombre)" de la misma venta en el chat de MoneyCars.
const INNO_EMPLOYEE_FIX = [
  { marker: "(línea 6240)", employee: "Ale", label: "Columna de dirección Spark negro (N1391)" },
  { marker: "(línea 6256)", employee: "Stiven", label: "Rejilla aire acondicionado Logan plomo (N1441)" },
];
// "dos rejillas Logan dorado y Logan crema": 2 rejillas de $10, cada una de un auto distinto.
const INNO_REJILLAS = {
  marker: "(línea 6246)",
  items: [
    { text: "rejilla aire acondicionado 1", price: 10, vehicle: "LOGAN_DORADO" },
    { text: "rejilla aire acondicionado 2", price: 10, vehicle: "LOGAN_CREMA" },
  ],
};

// ---------------------------------------------------------------------------
type Ctx = {
  catalog: Record<Business, CatalogEntry[]>;
  catalogCategory: Map<string, string>; // partTypeId -> categoryId
  categoryNameById: Map<string, string>;
  categoryIdByName: Map<string, string>;
  employeeId: Map<string, string>;
};

const money = (n: number) => n.toFixed(2);

function resolveMatch(item: Item, business: Business, ctx: Ctx) {
  if (item.free) return null;
  if (item.catalog) {
    const entry = ctx.catalog[business].find((c) => c.name.toLowerCase() === item.catalog!.toLowerCase());
    if (!entry) throw new Error(`No existe "${item.catalog}" en el catálogo de ${business}`);
    return { entry, score: 2, sideAssumed: false };
  }
  return matchPiece(item.text, ctx.catalog[business]);
}

function describeMatch(item: Item, business: Business, ctx: Ctx) {
  if (item.free) return "texto libre (va a Revisar coincidencias)";
  const m = resolveMatch(item, business, ctx);
  if (item.catalog) return `${m!.entry.name} (forzado)`;
  return m ? `${m.entry.name} (${m.score.toFixed(2)}${m.score < 0.75 ? ", revisar" : ""})` : "SIN COINCIDENCIA (va a Revisar coincidencias)";
}

async function vehicleId(business: Business, key: string): Promise<string> {
  const v =
    business === "MONEYCARS"
      ? await prisma.sourceVehicle.findMany({ where: { business, model: key } })
      : await prisma.sourceVehicle.findMany({ where: { business, notes: { contains: `variante detectada: ${key}. Año` } } });
  if (v.length !== 1) throw new Error(`Vehículo "${key}" (${business}): se esperaba 1 y hay ${v.length}`);
  return v[0].id;
}

async function buildPartData(item: Item, business: Business, vehId: string | null, ctx: Ctx, sku: string) {
  const m = resolveMatch(item, business, ctx);
  let partTypeId: string;
  let note: string;
  if (m) {
    partTypeId = m.entry.id;
    note = `${SOLD_AS}${item.text}${m.sideAssumed ? " (lado no especificado)" : ""}${m.score < 0.75 ? " (revisar)" : ""}`;
  } else {
    const catName = inferCategory(item.text);
    const categoryId = ctx.categoryIdByName.get(catName) ?? ctx.categoryIdByName.get("Otro")!;
    const t = await prisma.partType.create({
      data: {
        business,
        name: item.text.slice(0, 250),
        categoryId,
        description: `Migrado de WhatsApp (septiembre 2026, PDF): "${item.text}"`,
      },
    });
    partTypeId = t.id;
    note = `${SOLD_AS}${item.text}`;
  }
  return {
    business,
    sku,
    partTypeId,
    sourceVehicleId: vehId,
    condition: "USED_GOOD" as const,
    status: "SOLD" as const,
    cost: 0,
    price: item.price,
    notes: note,
  };
}

async function nextSkus(categories: string[]): Promise<string[]> {
  if (categories.length === 0) return [];
  const seq = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('part_sku_seq') AS n FROM generate_series(1, ${categories.length})`;
  return categories.map((c, i) => `${categoryCode(c)}-${seq[i].n.toString().padStart(6, "0")}`);
}

function categoryOfItem(item: Item, business: Business, ctx: Ctx): string {
  const m = resolveMatch(item, business, ctx);
  if (m) return ctx.categoryNameById.get(ctx.catalogCategory.get(m.entry.id)!) ?? "Otro";
  return inferCategory(item.text);
}

async function createItems(
  saleId: string,
  items: (Item & { vehicle?: string })[],
  business: Business,
  defaultVehicleId: string | null,
  ctx: Ctx,
) {
  const skus = await nextSkus(items.map((it) => categoryOfItem(it, business, ctx)));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const vehId = it.vehicle ? await vehicleId(business, it.vehicle) : defaultVehicleId;
    const part = await prisma.part.create({ data: await buildPartData(it, business, vehId, ctx, skus[i]) });
    await prisma.saleItem.create({ data: { saleId, partId: part.id, priceSold: it.price } });
  }
}

async function addSale(s: NewSale, ctx: Ctx) {
  const total = s.items.reduce((a, i) => a + i.price, 0);
  const marker = `Migrado de WhatsApp ${s.business === "INNOMUNDO" ? "Innomundo " : ""}${s.n} (septiembre 2026, PDF) [${s.vehicle}]`;
  const exists = await prisma.sale.findFirst({ where: { business: s.business, notes: marker } });
  console.log(`  + ${s.n} ${s.date.toLocaleString("es-EC")} ${s.employee} [${s.vehicle}] $${money(total)}${exists ? "  (YA REGISTRADA, se omite)" : ""}`);
  for (const it of s.items) console.log(`      $${money(it.price).padStart(7)}  ${it.text}  ->  ${describeMatch(it, s.business, ctx)}`);
  if (exists || !COMMIT) return exists ? 0 : total;

  const veh = await vehicleId(s.business, s.vehicle);
  const sale = await prisma.sale.create({
    data: { business: s.business, employeeId: ctx.employeeId.get(s.employee), saleDate: s.date, totalAmount: total, notes: marker },
  });
  await createItems(sale.id, s.items, s.business, veh, ctx);
  return total;
}

async function main() {
  console.log(COMMIT ? "== APLICANDO ==" : "== SIMULACIÓN (no se escribe nada) ==");

  const categories = await prisma.category.findMany();
  const catalogRows = await prisma.partType.findMany({
    where: { catalog: true, zone: { not: null } },
    select: { id: true, business: true, name: true, zone: true, categoryId: true },
  });
  const ctx: Ctx = {
    catalog: {
      MONEYCARS: buildCatalog(catalogRows.filter((c) => c.business === "MONEYCARS").map((c) => ({ id: c.id, name: c.name, zone: c.zone! }))),
      INNOMUNDO: buildCatalog(catalogRows.filter((c) => c.business === "INNOMUNDO").map((c) => ({ id: c.id, name: c.name, zone: c.zone! }))),
    },
    catalogCategory: new Map(catalogRows.map((c) => [c.id, c.categoryId])),
    categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
    categoryIdByName: new Map(categories.map((c) => [c.name, c.id])),
    employeeId: new Map((await prisma.employee.findMany()).map((e) => [e.name, e.id])),
  };
  for (const name of new Set([...MC_NEW, ...INNO_NEW].map((s) => s.employee))) {
    if (!ctx.employeeId.has(name)) throw new Error(`Empleado "${name}" no existe`);
  }

  // 1) MoneyCars: ventas que faltan
  console.log("\n--- MoneyCars: ventas que faltan ---");
  let added = 0;
  for (const s of MC_NEW) added += await addSale(s, ctx);
  console.log(`  Subtotal MoneyCars agregado: $${money(added)}`);

  // 2) MoneyCars: precios por pieza
  console.log("\n--- MoneyCars: ventas ya registradas con precios por pieza a corregir ---");
  for (const fix of MC_FIX) {
    const sales = await prisma.sale.findMany({
      where: { business: "MONEYCARS", notes: { contains: fix.marker } },
      include: { items: { include: { part: { include: { partType: true, sourceVehicle: true } } } } },
    });
    for (const sale of sales) {
      const model = sale.items[0]?.part.sourceVehicle?.model ?? "";
      const target = fix.byVehicle[model];
      if (!target) {
        console.log(`  ! ${fix.n}: venta ${sale.id.slice(0, 8)} (${model}) sin detalle en el chat, se deja`);
        continue;
      }
      const cur = sale.items.map((i) => Number(i.priceSold)).sort((a, b) => a - b);
      const want = target.map((t) => t.price).sort((a, b) => a - b);
      const same = cur.length === want.length && cur.every((v, i) => Math.abs(v - want[i]) < 0.005);
      const total = target.reduce((a, t) => a + t.price, 0);
      console.log(`  ~ ${fix.n} [${model}] ahora: ${sale.items.map((i) => `${i.part.partType.name} $${money(Number(i.priceSold))}`).join(" | ")}${same ? "  (YA CUADRA)" : ""}`);
      for (const t of target) console.log(`      $${money(t.price).padStart(7)}  ${t.text}  ->  ${describeMatch(t, "MONEYCARS", ctx)}`);
      if (same || !COMMIT) continue;

      const veh = sale.items[0]!.part.sourceVehicleId;
      const oldItems = sale.items;
      await createItems(sale.id, target, "MONEYCARS", veh, ctx);
      await prisma.saleItem.deleteMany({ where: { id: { in: oldItems.map((i) => i.id) } } });
      await prisma.part.deleteMany({ where: { id: { in: oldItems.map((i) => i.partId) } } });
      await prisma.partType.deleteMany({
        where: { id: { in: oldItems.map((i) => i.part.partTypeId) }, catalog: false, parts: { none: {} } },
      });
      await prisma.sale.update({ where: { id: sale.id }, data: { totalAmount: total } });
    }
  }

  // 3) Innomundo
  console.log("\n--- Innomundo: ventas que faltan ---");
  let addedInno = 0;
  for (const s of INNO_NEW) addedInno += await addSale(s, ctx);
  console.log(`  Subtotal Innomundo agregado: $${money(addedInno)}`);

  console.log("\n--- Innomundo: quién vendió (según el chat de MoneyCars) ---");
  for (const f of INNO_EMPLOYEE_FIX) {
    const sale = await prisma.sale.findFirst({ where: { business: "INNOMUNDO", notes: { contains: f.marker } }, include: { employee: true } });
    if (!sale) { console.log(`  ! no encontré ${f.label}`); continue; }
    const done = sale.employee?.name === f.employee;
    console.log(`  ~ ${f.label}: ${sale.employee?.name ?? "—"} -> ${f.employee}${done ? "  (YA CUADRA)" : ""}`);
    if (!done && COMMIT) await prisma.sale.update({ where: { id: sale.id }, data: { employeeId: ctx.employeeId.get(f.employee) } });
  }

  console.log("\n--- Innomundo: dos rejillas Logan (cada una de su auto) ---");
  {
    const sale = await prisma.sale.findFirst({
      where: { business: "INNOMUNDO", notes: { contains: INNO_REJILLAS.marker } },
      include: { items: { include: { part: { include: { partType: true } } } } },
    });
    if (!sale) console.log("  ! no encontré la venta");
    else {
      const done = sale.items.length === 2 && sale.items.every((i) => i.part.notes?.startsWith(`${SOLD_AS}rejilla aire acondicionado`));
      console.log(`  ~ ahora: ${sale.items.map((i) => `${i.part.partType.name} $${money(Number(i.priceSold))}`).join(" | ")}${done ? "  (YA CUADRA)" : ""}`);
      for (const it of INNO_REJILLAS.items) console.log(`      $${money(it.price).padStart(7)}  ${it.text} [${it.vehicle}]  ->  ${describeMatch(it, "INNOMUNDO", ctx)}`);
      if (!done && COMMIT) {
        const old = sale.items;
        await createItems(sale.id, INNO_REJILLAS.items, "INNOMUNDO", null, ctx);
        await prisma.saleItem.deleteMany({ where: { id: { in: old.map((i) => i.id) } } });
        await prisma.part.deleteMany({ where: { id: { in: old.map((i) => i.partId) } } });
        await prisma.partType.deleteMany({ where: { id: { in: old.map((i) => i.part.partTypeId) }, catalog: false, parts: { none: {} } } });
      }
    }
  }

  console.log(COMMIT ? "\nListo." : "\n(simulación: no se escribió nada. Usa --commit para aplicar.)");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
