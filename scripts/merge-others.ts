import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Palabras que describen el estado/origen, no la pieza: van a las observaciones ("Vendida como: ...").
const DESCRIPTORS = new Set([
  "rota", "roto", "rotos", "rotas", "quemado", "quemados", "quemada", "quemadas", "trisada", "trisadas", "trisado",
  "reparada", "reparado", "golpeado", "golpeada", "doblados", "doblado", "incompleta", "incompleto", "masillado",
  "masillados", "armada", "armado", "completo", "completa", "toyota", "renault", "volkswagen", "corsa", "corolla",
  "optra", "optra1", "optra2", "optra3", "optra4", "optra5", "gris", "blanco", "gli", "chevistar", "twitter",
  "alterna", "metalica", "metalico", "tengo", "esteban", "n", "ll",
]);
const STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "para", "y"]);
const NUMBERS = new Set(["dos", "tres", "cuatro", "ocho", "ter", "un", "una"]);

const WORD_FIX: Record<string, string> = {
  swicht: "switch", swich: "switch", switch: "switch", tuvo: "tubo", arnes: "arnes", cabezera: "cabecera",
  cabezeras: "cabecera", visagra: "bisagra", visagras: "bisagra", parente: "parante", parentes: "parante",
  guardalodo: "guardalodo", guardalodos: "guardalodo", erg: "egr", pósterior: "posterior", posteriore: "posterior",
  derecha: "rh", derechas: "rh", derecho: "rh", izquierda: "lh", izquierdo: "lh", botones: "boton", botonera: "botonera",
  botoneras: "botonera", lamevidrios: "lamevidrio", cables: "cable", flexibles: "flexible", vinchas: "vincha",
  templadoras: "templadora", inmobilizador: "inmovilizador", pisaderas: "pisadera", lineas: "linea", tanques: "tanque",
  mangueras: "manguera", rejillas: "rejilla", sockets: "socket", refuerzos: "refuerzo", molduras: "moldura",
  manijas: "manija", cauchos: "caucho", estribos: "estribo", cerraduras: "cerradura", sensores: "sensor", letras: "letra",
  pernos: "perno", brazos: "brazo", bases: "base", seguros: "seguro", tapas: "tapa", campanas: "campana",
  jaladera: "jaladera", elevavidrios: "elevavidrio", plumas: "pluma", botonera_: "botonera",
};

type Parsed = { key: string; display: string; changed: boolean };

function parse(name: string): Parsed {
  const original = name.trim();
  const words = original.replace(/^\d+\s*/, "").split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const w of words) {
    const n = norm(w);
    if (NUMBERS.has(n) && kept.length === 0) continue;
    if (DESCRIPTORS.has(n)) continue;
    kept.push(w);
  }
  if (kept.length === 0) kept.push(...words); // "completo" solo → se deja
  const nice = kept.join(" ");
  const keyWords = kept
    .map((w) => norm(w))
    .filter((w) => !STOP.has(w))
    .map((w) => WORD_FIX[w] ?? w);
  const key = keyWords.join(" ");
  const display = nice.replace(/\bswic?ht?\b/gi, "Switch").replace(/\b(lh|rh|dlh)\b/gi, (m) => m.toUpperCase()).replace(/^./, (c) => c.toUpperCase());
  return { key, display, changed: norm(display) !== norm(original) };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const types = await prisma.partType.findMany({
    where: { catalog: false },
    select: { id: true, name: true, categoryId: true, _count: { select: { parts: true } } },
  });

  // "Chatarra taller" / "Chatarras taller"
  const groups = new Map<string, { t: (typeof types)[number]; p: Parsed }[]>();
  for (const t of types) {
    const p = parse(t.name);
    const key = p.key.replace(/^chatarras?\b/, "chatarra");
    const arr = groups.get(key) ?? [];
    arr.push({ t, p });
    groups.set(key, arr);
  }

  let merged = 0;
  let removed = 0;
  let renamed = 0;
  const report: string[] = [];

  for (const [, members] of groups) {
    // nombre canónico: el más frecuente entre los mostrados; en empate, el más corto
    const freq = new Map<string, number>();
    for (const m of members) freq.set(m.p.display, (freq.get(m.p.display) ?? 0) + Math.max(1, m.t._count.parts));
    const display = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]
      .replace(/^chatarras\b/i, "Chatarra");
    const keeper = [...members].sort((a, b) => b.t._count.parts - a.t._count.parts)[0].t;
    const others = members.filter((m) => m.t.id !== keeper.id);

    if (members.length > 1) report.push(`${members.length}× ${display}   ← ${members.map((m) => m.t.name).join(" | ")}`);
    if (!apply) continue;

    if (keeper.name !== display) {
      await prisma.partType.update({ where: { id: keeper.id }, data: { name: display } });
      renamed++;
    }
    if (others.length) {
      const ids = others.map((o) => o.t.id);
      await prisma.part.updateMany({ where: { partTypeId: { in: ids } }, data: { partTypeId: keeper.id } });
      await prisma.partCompatibility.deleteMany({ where: { partTypeId: { in: ids } } });
      const d = await prisma.partType.deleteMany({ where: { id: { in: ids }, parts: { none: {} } } });
      removed += d.count;
      merged++;
    }
  }

  console.log(report.join("\n"));
  console.log({ tiposAntes: types.length, tiposDespues: groups.size, merged, removed, renamed, apply });
}
main().finally(() => prisma.$disconnect());
