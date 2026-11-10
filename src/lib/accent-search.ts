import { prisma } from "@/lib/prisma";
import type { Business } from "@/generated/prisma/enums";
import { matchesSearch, normalizeText, searchTokens } from "@/lib/text";

/**
 * Postgres no ignora tildes al buscar ("arnes" no encuentra "Arnés"), así que los nombres (pocos cientos
 * de piezas, decenas de vehículos y empleados) se comparan aquí y se devuelven los ids que coinciden.
 */
export async function partTypeIdsMatching(business: Business, query: string): Promise<string[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const types = await prisma.partType.findMany({ where: { business }, select: { id: true, name: true } });
  return types.filter((t) => matchesSearch(t.name, tokens)).map((t) => t.id);
}

/** Vehículos cuyo "marca modelo color" contiene todas las palabras. */
export async function vehicleIdsMatching(business: Business, query: string): Promise<string[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const vehicles = await prisma.sourceVehicle.findMany({
    where: { business },
    select: { id: true, brand: true, model: true, color: true },
  });
  return vehicles
    .filter((v) => matchesSearch(`${v.brand} ${v.model} ${v.color ?? ""}`, tokens))
    .map((v) => v.id);
}

export async function employeeIdsMatching(query: string): Promise<string[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];
  const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
  return employees.filter((e) => matchesSearch(e.name, tokens)).map((e) => e.id);
}

// ---- notas (texto libre): se comparan en SQL quitando tildes con translate() ----

const FROM = "áéíóúüñÁÉÍÓÚÜÑ";
const TO = "aeiouunaeiouun";

function likePattern(query: string): string {
  // misma normalización que el resto; se escapan % _ \ para que sean texto literal
  const n = normalizeText(query)
    .trim()
    .replace(/[\\%_]/g, (c) => "\\" + c);
  return `%${n}%`;
}

export async function saleIdsWithNotesMatching(business: Business, query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Sale"
    WHERE business = ${business}::"Business"
      AND lower(translate(coalesce(notes, ''), ${FROM}, ${TO})) LIKE ${likePattern(query)}`;
  return rows.map((r) => r.id);
}

export async function partIdsWithNotesMatching(business: Business, query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Part"
    WHERE business = ${business}::"Business"
      AND lower(translate(coalesce(notes, ''), ${FROM}, ${TO})) LIKE ${likePattern(query)}`;
  return rows.map((r) => r.id);
}
