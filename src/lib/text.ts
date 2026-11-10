/** Minúsculas y sin tildes: "Arnés" y "arnes" quedan iguales para buscar. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Divide una búsqueda en palabras ya normalizadas. */
export function searchTokens(q: string): string[] {
  return normalizeText(q).split(/\s+/).filter(Boolean);
}

/** ¿Contiene `text` todas las palabras de la búsqueda (sin importar tildes ni mayúsculas)? */
export function matchesSearch(text: string, tokens: string[]): boolean {
  const n = normalizeText(text);
  return tokens.every((t) => n.includes(t));
}
