// Separa descripciones de venta en piezas individuales y las hace coincidir con el catálogo.

const SIDE_WORDS: Record<string, string> = {
  lh: "lh",
  izq: "lh",
  izquierdo: "lh",
  izquierda: "lh",
  izquierdos: "lh",
  izquierdas: "lh",
  rh: "rh",
  der: "rh",
  derecho: "rh",
  derecha: "rh",
  derechos: "rh",
  derechas: "rh",
};

const POSITION_WORDS: Record<string, string> = {
  delantero: "delantero",
  delantera: "delantero",
  delanteros: "delantero",
  delanteras: "delantero",
  frontal: "delantero",
  posterior: "posterior",
  posteriores: "posterior",
  trasero: "posterior",
  trasera: "posterior",
  traseros: "posterior",
  traseras: "posterior",
  pos: "posterior",
};

const SYNONYMS: Record<string, string> = {
  chapa: "cerradura",
  chapas: "cerradura",
  cerraduras: "cerradura",
  guardabarro: "guardafango",
  guardabarros: "guardafango",
  aleta: "guardafango",
  parachoque: "guardachoque",
  parachoques: "guardachoque",
  guardachoques: "guardachoque",
  paragolpe: "guardachoque",
  bumper: "guardachoque",
  espejo: "retrovisor",
  espejos: "retrovisor",
  retrovisores: "retrovisor",
  rin: "aro",
  rines: "aro",
  aros: "aro",
  cristal: "vidrio",
  vidrios: "vidrio",
  elevadovidrio: "elevavidrio",
  elevadovidrios: "elevavidrio",
  elevavidrios: "elevavidrio",
  alzavidrio: "elevavidrio",
  alzavidrios: "elevavidrio",
  manijas: "manija",
  jaladeras: "jaladera",
  pisadera: "pisa pies",
  pisaderas: "pisa pies",
  gasolina: "combustible",
  ac: "aire",
  bombin: "bomba",
  cilindros: "cilindro",
  lamevidrio: "lamevidrios",
  guarfango: "guardafango",
  guarfangos: "guardafango",
  electro: "electroventilador",
  electros: "electroventilador",
  compu: "computadora",
  linea: "caneria",
  lineas: "caneria",
  pedal: "pedalera",
  pedales: "pedalera",
  calefaccion: "calefactor",
  tapizado: "tapiceria",
  tapizados: "tapiceria",
  bisagra: "visagra",
  bisagras: "visagra",
  visagras: "visagra",
  visagra: "visagra",
  portagafas: "portagafas",
  cofre: "capot",
  capo: "capot",
  maletero: "cajuela",
  baul: "cajuela",
  tapicerias: "tapiceria",
  alfombras: "alfombra",
  radiadores: "radiador",
  neblineros: "neblinero",
  luz: "foco",
  luces: "foco",
  faros: "faro",
  faroles: "faro",
  bateria: "bateria",
  compacto: "compacto",
  compactos: "compacto",
  cabeceras: "cabecera",
  apoyacabezas: "cabecera",
  apoyacabeza: "cabecera",
  cinturones: "cinturon",
  parasol: "visera",
  parasoles: "visera",
  viseras: "visera",
  parlantes: "parlante",
  tacometro: "tablero",
  computadora: "computadora",
  ecu: "computadora",
  bomba: "bomba",
};

const STOP = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas", "para", "en", "sin", "al", "por",
  "roto", "rota", "rotos", "rotas", "danado", "danada", "armado", "armada", "completo", "completa",
  "completos", "completas", "original", "nuevo", "nueva", "usado", "usada", "con", "y", "e", "o", "x",
  "par", "juego", "pieza", "piezas", "lado", "solo", "sola", "tipo", "lata", "metal", "interno", "interna", "externo", "externa",
]);

export function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Stemmer simple, aplicado igual al catálogo y al texto vendido
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ces")) return w.slice(0, -3) + "z";
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

export type Tokens = { words: Set<string>; sides: Set<string>; positions: Set<string> };

export function tokenize(text: string): Tokens {
  const cleaned = stripAccents(text.toLowerCase())
    .replace(/\(.*?\)/g, " ")
    .replace(/\bx\s*\d+\b/g, " ")
    .replace(/\b(3er|3r|tercer)\b/g, " tercer ")
    .replace(/\bpalancas?\s+(de\s+)?luces\b/g, " mando luces ")
    .replace(/\bpalancas?\s+(de\s+)?plumas\b/g, " mando plumas ")
    .replace(/\bporta\s+gafas\b/g, " portagafas ")
    .replace(/[^a-z\s]/g, " ");
  const words = new Set<string>();
  const sides = new Set<string>();
  const positions = new Set<string>();
  for (const raw of cleaned.split(/\s+/).filter(Boolean)) {
    if (SIDE_WORDS[raw]) {
      sides.add(SIDE_WORDS[raw]);
      continue;
    }
    if (POSITION_WORDS[raw]) {
      positions.add(POSITION_WORDS[raw]);
      continue;
    }
    if (STOP.has(raw)) continue;
    const syn = SYNONYMS[raw] ?? raw;
    for (const part of syn.split(" ")) {
      if (STOP.has(part)) continue;
      words.add(stem(part));
    }
  }
  return { words, sides, positions };
}

// ---------------------------------------------------------------------------
// Separar una descripción en piezas
// ---------------------------------------------------------------------------
const SEPARATORS = /\s*\+\s*|\s*;\s*|\s*,\s*|\s+y\s+|\s+e\s+|\s+con\s+/gi;

function isOnlyModifiers(fragment: string): boolean {
  const t = tokenize(fragment);
  return t.words.size === 0 && (t.sides.size > 0 || t.positions.size > 0);
}

// Quita del fragmento las palabras de lado/posición para reutilizar el "núcleo" de la pieza anterior
function headOf(fragment: string): string {
  return fragment
    .split(/\s+/)
    .filter((w) => {
      const n = stripAccents(w.toLowerCase());
      return !SIDE_WORDS[n] && !POSITION_WORDS[n];
    })
    .join(" ");
}

export function splitPieces(description: string): string[] {
  const rough = description
    .replace(/\s+/g, " ")
    .split(SEPARATORS)
    .map((f) => f.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const frag of rough) {
    if (isOnlyModifiers(frag) && out.length) {
      // "ejes LH y RH": el fragmento "RH" hereda el nombre de la pieza anterior
      const prev = out[out.length - 1];
      out.push(`${headOf(prev)} ${frag}`.replace(/\s+/g, " ").trim());
      continue;
    }
    const t = tokenize(frag);
    if (t.words.size === 0 && t.sides.size === 0 && t.positions.size === 0) continue; // ruido ("de", "roto")
    out.push(frag);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Coincidencia con el catálogo
// ---------------------------------------------------------------------------
export type CatalogEntry = { id: string; name: string; zone: string; tokens: Tokens };

export function buildCatalog(items: { id: string; name: string; zone: string }[]): CatalogEntry[] {
  return items.map((i) => ({ ...i, tokens: tokenize(i.name) }));
}

export type Match = {
  entry: CatalogEntry;
  score: number;
  sideAssumed: boolean;
};

const MIN_SCORE = 0.6;

export function matchPiece(piece: string, catalog: CatalogEntry[]): Match | null {
  const p = tokenize(piece);
  if (p.words.size === 0) return null;

  let best: Match | null = null;

  for (const c of catalog) {
    // El lado y la posición, si ambos los indican, deben coincidir
    if (p.sides.size && c.tokens.sides.size && ![...p.sides].some((s) => c.tokens.sides.has(s))) continue;
    if (p.positions.size && c.tokens.positions.size && ![...p.positions].some((s) => c.tokens.positions.has(s))) continue;

    let common = 0;
    for (const w of p.words) if (c.tokens.words.has(w)) common++;
    if (common === 0) continue;

    const dice = (2 * common) / (p.words.size + c.tokens.words.size);
    // Una pieza corta contenida en el nombre del catálogo ("block" en "Block de motor") también cuenta
    const contained = common === p.words.size && c.tokens.words.size - common <= 2;
    let score = contained ? Math.max(dice, 0.62) : dice;

    // Bonificaciones/penalizaciones por lado y posición
    if (p.sides.size && c.tokens.sides.size) score += 0.05;
    else if (p.sides.size !== c.tokens.sides.size) score -= 0.03;
    if (p.positions.size && c.tokens.positions.size) score += 0.05;
    else if (p.positions.size !== c.tokens.positions.size) score -= 0.03;

    if (!best || score > best.score + 1e-9) {
      best = { entry: c, score, sideAssumed: p.sides.size === 0 && c.tokens.sides.size > 0 };
    }
  }

  return best && best.score >= MIN_SCORE ? best : null;
}
