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
