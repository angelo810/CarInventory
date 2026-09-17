import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { PartStatus } from "@/generated/prisma/enums";

export type PartSearchFilters = {
  q?: string;
  brand?: string;
  model?: string;
  year?: number;
  categoryId?: string;
  status?: PartStatus | "ALL";
};

const SIMILARITY_THRESHOLD = 0.25;

export async function searchPartTypes(filters: PartSearchFilters) {
  const { q, brand, model, year, categoryId, status = "AVAILABLE" } = filters;

  const tokens = (q ?? "").trim().split(/\s+/).filter(Boolean);
  const yearTokens = tokens.filter((t) => /^(19|20)\d{2}$/.test(t)).map(Number);
  const textTokens = tokens.filter((t) => !/^(19|20)\d{2}$/.test(t));

  const conditions: Prisma.Sql[] = [];

  // Each free-text token must fuzzily match the part name, its category, one of its
  // compatible brand/models, or one of its unit SKUs (typo-tolerant via pg_trgm).
  for (const token of textTokens) {
    const like = `%${token}%`;
    conditions.push(Prisma.sql`
      (
        similarity(pt.name, ${token}) > ${SIMILARITY_THRESHOLD} OR pt.name ILIKE ${like}
        OR similarity(cat.name, ${token}) > ${SIMILARITY_THRESHOLD} OR cat.name ILIKE ${like}
        OR EXISTS (
          SELECT 1 FROM "PartCompatibility" pc
          WHERE pc."partTypeId" = pt.id
            AND (
              similarity(pc.brand, ${token}) > ${SIMILARITY_THRESHOLD} OR pc.brand ILIKE ${like}
              OR similarity(pc.model, ${token}) > ${SIMILARITY_THRESHOLD} OR pc.model ILIKE ${like}
            )
        )
        OR EXISTS (
          SELECT 1 FROM "Part" p
          WHERE p."partTypeId" = pt.id
            AND (similarity(p.sku, ${token}) > ${SIMILARITY_THRESHOLD} OR p.sku ILIKE ${like})
        )
      )
    `);
  }

  for (const y of yearTokens.length ? yearTokens : year ? [year] : []) {
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM "PartCompatibility" pc
        WHERE pc."partTypeId" = pt.id AND pc."yearFrom" <= ${y} AND pc."yearTo" >= ${y}
      )
    `);
  }

  if (brand) {
    const like = `%${brand}%`;
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM "PartCompatibility" pc
        WHERE pc."partTypeId" = pt.id
          AND (similarity(pc.brand, ${brand}) > ${SIMILARITY_THRESHOLD} OR pc.brand ILIKE ${like})
      )
    `);
  }

  if (model) {
    const like = `%${model}%`;
    conditions.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM "PartCompatibility" pc
        WHERE pc."partTypeId" = pt.id
          AND (similarity(pc.model, ${model}) > ${SIMILARITY_THRESHOLD} OR pc.model ILIKE ${like})
      )
    `);
  }

  if (categoryId) {
    conditions.push(Prisma.sql`pt."categoryId" = ${categoryId}`);
  }

  if (status !== "ALL") {
    conditions.push(Prisma.sql`
      EXISTS (SELECT 1 FROM "Part" p WHERE p."partTypeId" = pt.id AND p.status = ${status}::"PartStatus")
    `);
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  const scoreExpr =
    textTokens.length > 0
      ? Prisma.sql`GREATEST(${Prisma.join(
          textTokens.map((t) => Prisma.sql`similarity(pt.name, ${t})`),
          ", ",
        )})`
      : Prisma.sql`0`;

  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    SELECT pt.id as id, ${scoreExpr} as score
    FROM "PartType" pt
    JOIN "Category" cat ON cat.id = pt."categoryId"
    ${whereClause}
    ORDER BY score DESC, pt.name ASC
    LIMIT 40
  `;

  if (rows.length === 0) return [];

  const partsWhere: Prisma.PartWhereInput | undefined =
    status === "ALL" ? undefined : { status: status as PartStatus };

  const partTypes = await prisma.partType.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    include: {
      category: true,
      compatibilities: true,
      parts: {
        where: partsWhere,
        orderBy: { price: "asc" },
        include: { sourceVehicle: true },
      },
    },
  });

  const order = new Map(rows.map((r, i) => [r.id, i]));
  return partTypes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
