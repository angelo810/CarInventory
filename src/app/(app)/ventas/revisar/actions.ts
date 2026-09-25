"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth-guard";

const SOLD_AS = "Vendida como: ";
const FLAGS = /( \((lado no especificado|revisar|asignada)\))+$/;

export async function assignCatalogPart(input: {
  text: string;
  kind: "unmatched" | "review";
  catalogName: string;
}): Promise<{ error?: string; updated?: number }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const name = input.catalogName.trim();
  if (!name) return { error: "Escribe o elige el nombre de la pieza del catálogo." };

  const catalogType = await prisma.partType.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    orderBy: { catalog: "desc" },
  });
  if (!catalogType) return { error: `No encontré "${name}" en el catálogo. Elígela de la lista.` };

  const candidates = await prisma.part.findMany({
    where: {
      status: "SOLD",
      notes: { startsWith: `${SOLD_AS}${input.text}` },
      partType: { catalog: input.kind === "review" },
    },
    select: { id: true, notes: true, partTypeId: true },
  });
  const parts = candidates.filter((p) => (p.notes ?? "").slice(SOLD_AS.length).replace(FLAGS, "") === input.text);
  if (parts.length === 0) return { error: "Ya no hay piezas con ese texto." };

  const oldTypeIds = [...new Set(parts.map((p) => p.partTypeId))];

  await prisma.$transaction(async (tx) => {
    await tx.part.updateMany({
      where: { id: { in: parts.map((p) => p.id) } },
      data: { partTypeId: catalogType.id, notes: `${SOLD_AS}${input.text}${catalogType.catalog ? "" : " (asignada)"}` },
    });
    // Tipos libres que quedaron sin piezas
    await tx.partType.deleteMany({
      where: { id: { in: oldTypeIds }, catalog: false, parts: { none: {} } },
    });
  });

  revalidatePath("/ventas");
  revalidatePath("/ventas/revisar");
  revalidatePath("/vehiculos");
  return { updated: parts.length };
}

/**
 * Borra por completo (de la venta y del inventario) todas las piezas migradas cuyo texto de chat
 * no coincide con ningún tipo del catálogo — para basura de la migración (ej. "n Esteban", "y",
 * "venta por") que no es una pieza real. Ajusta el total de cada venta afectada y borra la venta si
 * se queda sin piezas.
 */
export async function deleteUnmatchedGroup(text: string): Promise<{ error?: string; deleted?: number }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const candidates = await prisma.part.findMany({
    where: {
      status: "SOLD",
      notes: { startsWith: `${SOLD_AS}${text}` },
      partType: { catalog: false },
    },
    select: { id: true, partTypeId: true, notes: true, saleItems: { select: { id: true, saleId: true, priceSold: true } } },
  });
  const parts = candidates.filter((p) => (p.notes ?? "").slice(SOLD_AS.length).replace(FLAGS, "") === text);
  if (parts.length === 0) return { error: "Ya no hay piezas con ese texto." };

  const typeIds = [...new Set(parts.map((p) => p.partTypeId))];

  await prisma.$transaction(async (tx) => {
    const saleDeltas = new Map<string, number>();
    for (const part of parts) {
      for (const item of part.saleItems) {
        saleDeltas.set(item.saleId, (saleDeltas.get(item.saleId) ?? 0) + Number(item.priceSold));
      }
    }

    await tx.saleItem.deleteMany({ where: { partId: { in: parts.map((p) => p.id) } } });
    await tx.part.deleteMany({ where: { id: { in: parts.map((p) => p.id) } } });
    await tx.partType.deleteMany({ where: { id: { in: typeIds }, catalog: false, parts: { none: {} } } });

    for (const [saleId, amount] of saleDeltas) {
      const remaining = await tx.saleItem.count({ where: { saleId } });
      if (remaining === 0) {
        await tx.sale.delete({ where: { id: saleId } });
      } else {
        await tx.sale.update({ where: { id: saleId }, data: { totalAmount: { decrement: amount } } });
      }
    }
  });

  revalidatePath("/ventas");
  revalidatePath("/ventas/revisar");
  revalidatePath("/vehiculos");
  revalidatePath("/finanzas");
  revalidatePath("/");
  return { deleted: parts.length };
}

/**
 * Confirma de una sola vez todas las coincidencias propuestas por el sistema con poca seguridad
 * (quita la marca "(revisar)"). No cambia a qué pieza del catálogo quedaron asignadas, solo las
 * da por buenas.
 */
export async function confirmAllReviewMatches(): Promise<{ error?: string; confirmed?: number }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  // Una sola sentencia (en vez de una actualización por pieza dentro de una transacción larga,
  // que en Neon se corta por tiempo con cientos de filas).
  const result = await prisma.$executeRaw`
    UPDATE "Part" p
    SET notes = REPLACE(p.notes, ' (revisar)', '')
    FROM "PartType" pt
    WHERE p."partTypeId" = pt.id
      AND p.status = 'SOLD'
      AND pt.catalog = true
      AND p.notes LIKE '%(revisar)%'
  `;

  revalidatePath("/ventas");
  revalidatePath("/ventas/revisar");
  revalidatePath("/vehiculos");
  return { confirmed: Number(result) };
}
