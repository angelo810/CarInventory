/**
 * Reordena los vehículos de Innomundo según la lista oficial del Excel (scripts/data/innomundo-vehiculos.json):
 * cada venta se asigna a UN vehículo oficial en vez de los ~120 "tags" que creó la importación.
 *
 * Cómo decide a qué vehículo va cada venta:
 *   1. alias    -> el texto del chat nombra al vehículo ("Spark negro", "Logan taxi"...), usando
 *                  la columna A del Excel (cómo se nombraba en el chat) y la B (nombre oficial).
 *   2. contexto -> solo dice la familia ("Corsa", "Logan") o nada: se elige entre los vehículos
 *                  que el Excel muestra con ventas en ese año/mes, el más cercano en el chat
 *                  a una venta que sí lo nombra explícitamente.
 *
 *   npx tsx scripts/fix-vehiculos-innomundo.ts <chat.txt>            -> reporte (no escribe)
 *   npx tsx scripts/fix-vehiculos-innomundo.ts <chat.txt> --apply    -> aplica
 */
import "dotenv/config";
import fs from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import vehiculosXlsx from "./data/innomundo-vehiculos.json";

const OWNER_BONUS = Number(process.env.OWNER_BONUS ?? 0);
const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");
const CHAT = process.argv.find((a) => a.endsWith(".txt"))!;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bwin\b/g, "wind")
    .replace(/\bx[ -]?trail\b/g, "xtrail")
    .replace(/\bd[ -]?max\b/g, "dmax")
    .replace(/\bpick[ -]?up\b/g, "pickup")
    .replace(/\bevo ?4\b/g, "evo")
    .replace(/[^a-z0-9, ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// brand / model / color oficiales por fila del Excel
const OFICIAL: Record<number, { brand: string; model: string; color?: string; year?: number }> = {
  4: { brand: "Chevrolet", model: "Corsa Wind 1.6", color: "Verde" },
  5: { brand: "Volkswagen", model: "Golf", color: "Vino" },
  6: { brand: "Hyundai", model: "Elantra" },
  7: { brand: "Jeep", model: "Cherokee", year: 1996 },
  8: { brand: "Renault", model: "Logan Taxi" },
  9: { brand: "Nissan", model: "Versa", color: "Negro" },
  10: { brand: "Chevrolet", model: "Corsa Wind Pick Up" },
  11: { brand: "Chevrolet", model: "Optra Hatchback" },
  12: { brand: "Toyota", model: "Corolla", color: "Dorado" },
  13: { brand: "Mazda", model: "Allegro" },
  14: { brand: "Chevrolet", model: "Spark LT", color: "Plomo" },
  15: { brand: "Renault", model: "Clio" },
  16: { brand: "Renault", model: "Logan", color: "Dorado" },
  17: { brand: "Chevrolet", model: "Corsa Wind", color: "Blanco" },
  18: { brand: "Toyota", model: "Corolla", color: "Rojo" },
  19: { brand: "Chevrolet", model: "Spark LT", color: "Naranja" },
  20: { brand: "Chevrolet", model: "Corsa Wind 3 Puertas" },
  21: { brand: "Renault", model: "Logan", color: "Azul" },
  22: { brand: "Chevrolet", model: "Aveo Activo" },
  23: { brand: "Chevrolet", model: "D-Max Diésel" },
  24: { brand: "Renault", model: "Mégane" },
  25: { brand: "Volkswagen", model: "Gol 3P" },
  26: { brand: "Nissan", model: "X-Trail Extreme" },
  27: { brand: "Desconocido", model: "Zoyte" },
  28: { brand: "Ford", model: "Festiva / F150" },
  29: { brand: "Ford", model: "Explorer" },
  30: { brand: "Chevrolet", model: "Corsa Wind 1.6 Sedán" },
  31: { brand: "Suzuki", model: "Vitara" },
  32: { brand: "Fiat", model: "Fiat 1" },
  33: { brand: "Volkswagen", model: "Voyage" },
  34: { brand: "Renault", model: "Logan" },
  35: { brand: "Chevrolet", model: "Optra", color: "Azul" },
  36: { brand: "Renault", model: "Logan", color: "Plomo" },
  37: { brand: "Chevrolet", model: "Astra" },
  38: { brand: "Renault", model: "Logan", color: "Crema" },
  39: { brand: "Renault", model: "Logan Carrocería" },
  40: { brand: "Chevrolet", model: "Corsa Evo", color: "Blanco" },
  41: { brand: "Chevrolet", model: "Aveo Emotion", color: "Rojo" },
  42: { brand: "Chevrolet", model: "Corsa Evo", color: "Rojo" },
  43: { brand: "Chevrolet", model: "Spark Life" },
  44: { brand: "Chevrolet", model: "Spark", color: "Negro" },
  45: { brand: "Chevrolet", model: "Optra Mono" },
};

// Familia -> filas del Excel (para ventas que solo dicen "Corsa", "Logan"...)
const FAMILIAS: { name: string; test: RegExp; rows: number[] }[] = [
  { name: "corsa", test: /\b(corsa|pickup|evo)\b/, rows: [4, 10, 17, 20, 30, 40, 42] },
  { name: "logan", test: /\blogan\b/, rows: [8, 16, 21, 34, 36, 38, 39] },
  { name: "optra", test: /\boptra\b/, rows: [11, 35, 45] },
  { name: "corolla", test: /\bcorolla\b/, rows: [12, 18] },
  { name: "spark", test: /\bspark\b/, rows: [14, 19, 43, 44] },
  { name: "aveo", test: /\baveo\b/, rows: [22, 41] },
  { name: "golf", test: /\bgolf\b/, rows: [5] },
  { name: "elantra", test: /\belantra\b/, rows: [6] },
  { name: "jeep", test: /\b(jeep|cherokee)\b/, rows: [7] },
  { name: "versa", test: /\bversa\b/, rows: [9] },
  { name: "mazda", test: /\b(mazda|allegro)\b/, rows: [13] },
  { name: "clio", test: /\bclio\b/, rows: [15] },
  { name: "dmax", test: /\bdmax\b/, rows: [23] },
  { name: "megane", test: /\bmegane\b/, rows: [24] },
  { name: "gol", test: /\bgol\b/, rows: [25] },
  { name: "xtrail", test: /\bxtrail\b/, rows: [26] },
  { name: "zoyte", test: /\bzoyte\b/, rows: [27] },
  { name: "ford", test: /\b(festiva|f150|f 150)\b/, rows: [28] },
  { name: "explorer", test: /\bexplorer\b/, rows: [29] },
  { name: "vitara", test: /\bvitara\b/, rows: [31] },
  { name: "fiat", test: /\bfiat\b/, rows: [32] },
  { name: "voyage", test: /\bvoyage\b/, rows: [33] },
  { name: "astra", test: /\bastra\b/, rows: [37] },
];

// Filas del Excel que NO son vehículo (Voyage: su única venta es del Gol)
const EXCLUIDAS = new Set([33]);

// Vehículos que aparecen en el chat pero NO están en el Excel: se dejan como están
const EXTRAS_MODELS = new Set(["Accent", "Terracan"]);

type Canon = { row: number; name: string; aliases: string[]; invest: number; total: number; buckets: Map<string, number> };

function bucketOf(d: Date) {
  return d.getFullYear() < 2026 ? String(d.getFullYear()) : `2026-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildCanon(): Canon[] {
  return vehiculosXlsx.filter((r) => !EXCLUIDAS.has(r.row)).map((r) => {
    const fromA = r.a.toUpperCase() === "OK" ? [] : r.a.split("/").map((s) => s.trim()).filter(Boolean);
    const fromB = r.b.split("/").map((s) => s.trim()).filter(Boolean);
    const aliases = [...new Set([...fromA, ...fromB].map(norm).filter(Boolean))];
    const buckets = new Map<string, number>();
    [2022, 2023, 2024, 2025].forEach((y, i) => buckets.set(String(y), [r.y1, r.y2, r.y3, r.y4][i]));
    r.months.forEach((v, i) => buckets.set(`2026-${String(i + 1).padStart(2, "0")}`, v));
    return { row: r.row, name: r.b.trim(), aliases, invest: r.invest, total: r.total, buckets };
  });
}

const fmt = (n: number) => n.toFixed(2);

async function main() {
  const canon = buildCanon();
  const byRow = new Map(canon.map((c) => [c.row, c]));
  const aliasIndex = canon
    .flatMap((c) => c.aliases.map((a) => ({ alias: a, c })))
    .sort((a, b) => b.alias.length - a.alias.length);

  const lines = fs.readFileSync(CHAT, "utf8").split(/\r?\n/);

  const oldVehicles = await prisma.sourceVehicle.findMany({ where: { business: "INNOMUNDO" } });
  const oldTag = new Map(oldVehicles.map((v) => [v.id, /detectada: ([^.]+)\./.exec(v.notes ?? "")?.[1]?.replace(/_/g, " ") ?? /según Excel \(([^)]+)\)/.exec(v.notes ?? "")?.[1] ?? ""]));
  const extraIds = new Set(oldVehicles.filter((v) => EXTRAS_MODELS.has(v.model)).map((v) => v.id));

  const sales = await prisma.sale.findMany({
    where: { business: "INNOMUNDO" },
    include: { items: { include: { part: true } } },
    orderBy: [{ saleDate: "asc" }, { createdAt: "asc" }],
  });

  // --- 1) texto de cada "unidad" a clasificar: la venta (por línea del chat) o, si no vino del chat, cada pieza ---
  type Unit = {
    id: string;
    saleId: string;
    partIds: string[];
    date: Date;
    amount: number;
    line: number;
    text: string;
    rows?: number[]; // candidatos
    owner?: number; // dueño del alias genérico ("logan" -> Logan)
    row?: number; // asignado
    method?: "alias" | "contexto" | "extra" | "sin-candidato";
  };
  const units: Unit[] = [];
  for (const s of sales) {
    const lm = /línea (\d+)/.exec(s.notes ?? "");
    if (lm) {
      const line = Number(lm[1]);
      units.push({
        id: s.id, saleId: s.id, partIds: s.items.map((i) => i.partId), date: s.saleDate,
        amount: s.items.reduce((a, i) => a + Number(i.priceSold), 0), line, text: lines[line - 1] ?? "",
      });
    } else {
      // ventas agregadas a mano (septiembre): una unidad por pieza, texto = vehículo antiguo
      for (const it of s.items) {
        units.push({
          id: `${s.id}:${it.id}`, saleId: s.id, partIds: [it.partId], date: s.saleDate, amount: Number(it.priceSold),
          line: 1e9, text: it.part.sourceVehicleId ? oldTag.get(it.part.sourceVehicleId) ?? "" : "",
        });
      }
    }
  }

  const extraPartIds = new Set(
    sales.flatMap((s) => s.items).filter((i) => i.part.sourceVehicleId && extraIds.has(i.part.sourceVehicleId)).map((i) => i.partId),
  );
  const isExtra = (u: Unit) => u.partIds.length > 0 && u.partIds.every((pid) => extraPartIds.has(pid));

  // --- 2) alias explícito ---
  // Un alias es "débil" si es parte del alias de OTRO vehículo ("logan" dentro de "logan taxi",
  // "corsa wind" dentro de "corsa wind verde"): ahí solo sabemos la familia, no el vehículo.
  const containsWord = (hay: string, needle: string) => (" " + hay + " ").includes(" " + needle + " ");
  const weakRows = new Map<string, number[]>(); // alias -> filas candidatas
  for (const { alias } of aliasIndex) {
    const owners = aliasIndex.filter((x) => x.alias === alias).map((x) => x.c.row);
    const others = aliasIndex
      .filter((x) => x.alias !== alias && containsWord(x.alias, alias) && !owners.includes(x.c.row))
      .map((x) => x.c.row);
    if (owners.length > 1 || others.length) weakRows.set(alias, [...new Set([...owners, ...others])]);
  }
  for (const u of units) {
    if (isExtra(u)) { u.method = "extra"; continue; }
    const n = " " + norm(u.text) + " ";
    const hit = aliasIndex.find((x) => n.includes(" " + x.alias + " "));
    if (hit) {
      const weak = weakRows.get(hit.alias);
      const ownerRows = aliasIndex.filter((x) => x.alias === hit.alias).map((x) => x.c.row);
      const b = bucketOf(u.date);
      const activos = ownerRows.filter((r) => (byRow.get(r)!.buckets.get(b) ?? 0) > 0);
      if (!weak) { u.row = hit.c.row; u.method = "alias"; }
      else if (ownerRows.length > 1 && activos.length === 1) { u.row = activos[0]; u.method = "alias"; }
      else if (ownerRows.length === 1 && activos.length === 1) { u.row = ownerRows[0]; u.method = "alias"; }
      else { u.rows = weak; u.owner = ownerRows.length === 1 ? ownerRows[0] : undefined; void b; }
    }
    if (!u.row && !u.rows) {
      const fam = FAMILIAS.find((f) => f.test.test(n));
      if (fam && fam.rows.length === 1) { u.row = fam.rows[0]; u.method = "alias"; }
      else if (fam) u.rows = fam.rows;
    }
  }

  // --- 3) contexto: totales por año/mes del Excel + auto "en curso" más cercano en el tiempo ---
  const explicit = units.filter((u) => u.method === "alias");
  const assignedSum = new Map<string, number>(); // `${row}|${bucket}` -> $ ya asignado
  const assignedTimes = new Map<number, number[]>(); // row -> fechas (ms) de ventas ya asignadas
  const note = (u: Unit) => {
    const k = `${u.row}|${bucketOf(u.date)}`;
    assignedSum.set(k, (assignedSum.get(k) ?? 0) + u.amount);
    assignedTimes.set(u.row!, [...(assignedTimes.get(u.row!) ?? []), u.date.getTime()]);
  };
  for (const u of explicit) note(u);
  const remaining = (row: number, b: string) => (byRow.get(row)!.buckets.get(b) ?? 0) - (assignedSum.get(`${row}|${b}`) ?? 0);
  const distDays = (row: number, t: number) => {
    const ts = assignedTimes.get(row);
    if (!ts?.length) return 9999;
    return Math.min(...ts.map((x) => Math.abs(x - t))) / 86400000;
  };

  const pending = units.filter((u) => !u.method).sort((a, b) => a.date.getTime() - b.date.getTime() || a.line - b.line);
  for (const u of pending) {
    const b = bucketOf(u.date);
    const pool = u.rows ?? canon.map((c) => c.row);
    let cands = pool.filter((r) => remaining(r, b) > 0);
    if (!cands.length && u.rows) cands = pool.filter((r) => (byRow.get(r)!.buckets.get(b) ?? 0) > 0);
    if (!cands.length && u.rows) cands = [...u.rows];
    if (!cands.length) { u.method = "sin-candidato"; continue; }
    const t = u.date.getTime();
    const score = (r: number) => Math.min(distDays(r, t), 400) - (r === u.owner ? OWNER_BONUS : 0);
    cands.sort((x, y) => score(x) - score(y) || remaining(y, b) - remaining(x, b));
    u.row = cands[0];
    u.method = "contexto";
    note(u);
  }


  // --- 4) reporte ---
  const count = (m: string) => units.filter((u) => u.method === m).length;
  const sumBy = (f: (u: Unit) => boolean) => units.filter(f).reduce((a, u) => a + u.amount, 0);
  console.log("Unidades:", units.length, "| alias:", count("alias"), "| contexto:", count("contexto"), "| extra:", count("extra"), "| sin candidato:", count("sin-candidato"));
  console.log("$ alias:", fmt(sumBy((u) => u.method === "alias")), "| $ contexto:", fmt(sumBy((u) => u.method === "contexto")), "| $ sin candidato:", fmt(sumBy((u) => u.method === "sin-candidato")), "| $ extra:", fmt(sumBy((u) => u.method === "extra")));

  console.log("\nVehículo oficial".padEnd(30), "Excel".padStart(10), "Asignado".padStart(10), "Dif".padStart(9), " (alias / contexto)");
  let absErr = 0;
  const assigned = new Map<number, { alias: number; ctx: number }>();
  for (const u of units) {
    if (!u.row) continue;
    const e = assigned.get(u.row) ?? { alias: 0, ctx: 0 };
    if (u.method === "alias") e.alias += u.amount; else e.ctx += u.amount;
    assigned.set(u.row, e);
  }
  for (const c of canon) {
    const e = assigned.get(c.row) ?? { alias: 0, ctx: 0 };
    const tot = e.alias + e.ctx;
    absErr += Math.abs(tot - c.total);
    console.log(c.name.padEnd(29), fmt(c.total).padStart(10), fmt(tot).padStart(10), fmt(tot - c.total).padStart(9), `  (${fmt(e.alias)} / ${fmt(e.ctx)})`);
  }
  console.log("Error absoluto total vs Excel:", fmt(absErr));

  if (VERBOSE) {
    for (const u of units.filter((x) => x.method === "sin-candidato").slice(0, 40)) console.log("SIN CAND", u.date.toISOString().slice(0, 10), u.amount, u.text.slice(0, 120));
  }

  // --- 5) aplicar ---
  if (!APPLY) { console.log("\n(reporte, no se escribió nada; usa --apply)"); return; }
  await apply(canon, units, oldVehicles, extraIds);
}

async function apply(
  canon: Canon[],
  units: { saleId: string; partIds: string[]; date: Date; row?: number; method?: string }[],
  oldVehicles: { id: string }[],
  extraIds: Set<string>,
) {
  // copia de seguridad para poder revertir (vehículos viejos + vínculo pieza -> vehículo)
  const backupPath = CHAT.replace(/[^\\/]+$/, `backup-vehiculos-innomundo-${Date.now()}.json`);
  const oldRows = await prisma.sourceVehicle.findMany({ where: { business: "INNOMUNDO" } });
  const partLinks = await prisma.part.findMany({ where: { business: "INNOMUNDO" }, select: { id: true, sourceVehicleId: true } });
  const expLinks = await prisma.expense.findMany({
    where: { business: "INNOMUNDO", sourceVehicleId: { not: null } },
    select: { id: true, sourceVehicleId: true },
  });
  fs.writeFileSync(backupPath, JSON.stringify({ oldRows, partLinks, expLinks }));
  console.log("Respaldo:", backupPath, `(${oldRows.length} vehículos, ${partLinks.length} piezas, ${expLinks.length} gastos)`);

  const firstDate = new Map<number, Date>();
  for (const u of units) {
    if (!u.row) continue;
    const d = firstDate.get(u.row);
    if (!d || u.date < d) firstDate.set(u.row, u.date);
  }

  const idByRow = new Map<number, string>();
  for (const c of canon) {
    const o = OFICIAL[c.row];
    const v = await prisma.sourceVehicle.create({
      data: {
        business: "INNOMUNDO",
        brand: o.brand,
        model: o.color ? `${o.model} ${o.color}` : o.model,
        year: o.year ?? 2010,
        color: o.color ?? null,
        purchaseDate: firstDate.get(c.row) ?? new Date(2022, 0, 1, 12),
        purchaseCost: c.invest,
        status: "DISMANTLED",
        notes: `Vehículo oficial según Excel (${c.name}). Inversión del Excel; año y fecha de compra estimados (primera venta) — verificar.`,
      },
    });
    idByRow.set(c.row, v.id);
  }

  let moved = 0;
  for (const c of canon) {
    const ids = units.filter((u) => u.row === c.row).flatMap((u) => u.partIds);
    if (!ids.length) continue;
    moved += await prisma.$executeRaw`UPDATE "Part" SET "sourceVehicleId" = ${idByRow.get(c.row)!} WHERE id = ANY(${ids}::text[])`;
  }
  // piezas sin vehículo asignado: desvincular de los fragmentos viejos (los extras se quedan)
  const old = oldVehicles.map((v) => v.id).filter((id) => !extraIds.has(id));
  const unlinked = await prisma.$executeRaw`UPDATE "Part" SET "sourceVehicleId" = NULL WHERE "sourceVehicleId" = ANY(${old}::text[])`;
  const exp = await prisma.$executeRaw`UPDATE "Expense" SET "sourceVehicleId" = NULL WHERE "sourceVehicleId" = ANY(${old}::text[])`;
  const del = await prisma.$executeRaw`DELETE FROM "SourceVehicle" WHERE id = ANY(${old}::text[])`;
  console.log({ vehiculosNuevos: idByRow.size, piezasMovidas: moved, piezasSinVehiculo: unlinked, gastosDesvinculados: exp, fragmentosEliminados: del });
}

main().finally(() => prisma.$disconnect());
