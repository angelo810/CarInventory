"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inferCategory } from "@/lib/categorize";
import { categoryCode } from "@/lib/sku";
import { assertAdmin } from "@/lib/auth-guard";
import { getActiveBusiness } from "@/lib/business";

const vehicleSchema = z.object({
  brand: z.string().min(1, "Marca requerida"),
  model: z.string().min(1, "Modelo requerido"),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  color: z.string().optional(),
  plate: z.string().optional(),
  purchaseDate: z.string().min(1, "Fecha requerida"),
  purchaseCost: z.coerce.number().min(0),
  condition: z.string().optional(),
  notes: z.string().optional(),
  checklist: z.string().optional(), // JSON: [[partTypeId, cantidad], ...]
  extras: z.string().optional(), // JSON: [{ name, zone, qty, addToCatalog }]
});

const extraSchema = z.object({
  name: z.string().trim().min(1),
  zone: z.enum(["INTERIOR", "MECHANICAL", "EXTERIOR", "DOCUMENTS", "SCRAP", "COMPLETE"]),
  qty: z.coerce.number().int().min(1).max(50),
  addToCatalog: z.boolean().optional(),
});

const checklistSchema = z.array(z.tuple([z.string(), z.coerce.number().int().min(1).max(50)]));

export type VehicleFormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function createVehicle(
  _prevState: VehicleFormState | undefined,
  formData: FormData,
): Promise<VehicleFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  let checklist: z.infer<typeof checklistSchema> = [];
  let extras: z.infer<typeof extraSchema>[] = [];
  try {
    if (data.checklist) checklist = checklistSchema.parse(JSON.parse(data.checklist));
    if (data.extras) extras = z.array(extraSchema).parse(JSON.parse(data.extras));
  } catch {
    return { error: "La lista de piezas tiene datos inválidos. Revisa cantidades y nombres de piezas extra." };
  }

  const business = await getActiveBusiness();
  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const zoneFallback = {
    INTERIOR: "Interior",
    MECHANICAL: "Motor",
    EXTERIOR: "Carrocería",
    DOCUMENTS: "Documentos",
    SCRAP: "Chatarra",
    COMPLETE: "Otro",
  } as const;

  let vehicleId: string;
  try {
    vehicleId = await prisma.$transaction(
      async (tx) => {
        const vehicle = await tx.sourceVehicle.create({
          data: {
            business,
            brand: data.brand,
            model: data.model,
            year: data.year,
            color: data.color || null,
            plate: data.plate || null,
            purchaseDate: new Date(`${data.purchaseDate}T12:00:00`),
            purchaseCost: data.purchaseCost,
            condition: data.condition || null,
            notes: data.notes || null,
          },
        });

        // Tipos de pieza: los del catálogo seleccionados + los extras (nuevos)
        const wanted: { partTypeId: string; categoryName: string; qty: number }[] = [];

        if (checklist.length) {
          const types = await tx.partType.findMany({
            where: { id: { in: checklist.map(([id]) => id) }, business },
            include: { category: true },
          });
          const byId = new Map(types.map((t) => [t.id, t]));
          for (const [id, qty] of checklist) {
            const t = byId.get(id);
            if (t) wanted.push({ partTypeId: t.id, categoryName: t.category.name, qty });
          }
        }

        for (const extra of extras) {
          let categoryName = inferCategory(extra.name);
          if (categoryName === "Otro") categoryName = zoneFallback[extra.zone];
          const category = categoryByName.get(categoryName) ?? categoryByName.get("Otro");
          if (!category) throw new Error("No hay categorías configuradas.");
          const type = await tx.partType.create({
            data: {
              business,
              name: extra.name,
              categoryId: category.id,
              zone: extra.zone,
              catalog: Boolean(extra.addToCatalog),
              kept: true,
            },
          });
          wanted.push({ partTypeId: type.id, categoryName: category.name, qty: extra.qty });
        }

        const total = wanted.reduce((sum, w) => sum + w.qty, 0);
        if (total > 0) {
          const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('part_sku_seq') AS n FROM generate_series(1, ${total})`;
          const costEach = Math.round((data.purchaseCost / total) * 100) / 100;
          let i = 0;
          const rows = wanted.flatMap((w) =>
            Array.from({ length: w.qty }, () => ({
              business,
              sku: `${categoryCode(w.categoryName)}-${seq[i++].n.toString().padStart(6, "0")}`,
              partTypeId: w.partTypeId,
              sourceVehicleId: vehicle.id,
              cost: costEach,
              price: 0,
            })),
          );
          await tx.part.createMany({ data: rows });
        }

        return vehicle.id;
      },
      { timeout: 60000, maxWait: 15000 },
    );
  } catch {
    return { error: "No se pudo crear el vehículo (verifica que la placa no esté repetida)." };
  }

  revalidatePath("/vehiculos");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  redirect(`/vehiculos/${vehicleId}?nuevo=1`);
}

export async function updateVehicleStatus(id: string, status: "IN_PROGRESS" | "DISMANTLED" | "ARCHIVED") {
  if (await assertAdmin()) return;
  await prisma.sourceVehicle.update({ where: { id }, data: { status } });
  revalidatePath(`/vehiculos/${id}`);
  revalidatePath("/vehiculos");
}

const vehicleEditSchema = vehicleSchema.omit({ checklist: true, extras: true });

export async function updateVehicle(
  vehicleId: string,
  _prevState: VehicleFormState | undefined,
  formData: FormData,
): Promise<VehicleFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const parsed = vehicleEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const data = parsed.data;

  const purchaseDate = new Date(`${data.purchaseDate}T12:00:00`);
  if (Number.isNaN(purchaseDate.getTime())) return { fieldErrors: { purchaseDate: ["Fecha inválida"] } };

  const current = await prisma.sourceVehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
  if (!current) return { error: "El vehículo ya no existe." };

  try {
    await prisma.sourceVehicle.update({
      where: { id: vehicleId },
      data: {
        brand: data.brand.trim(),
        model: data.model.trim(),
        year: data.year,
        color: data.color?.trim() || null,
        plate: data.plate?.trim() || null,
        purchaseDate,
        purchaseCost: data.purchaseCost,
        condition: data.condition?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });
  } catch {
    return { error: "No se pudo guardar (verifica que la placa no esté repetida en otro vehículo)." };
  }

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${vehicleId}`);
  revalidatePath("/finanzas");
  revalidatePath("/ventas");
  redirect(`/vehiculos/${vehicleId}`);
}

/**
 * Elimina un vehículo (ej. uno registrado por error). Si alguna de sus piezas ya se vendió no se
 * permite, porque se perdería esa venta; en ese caso se archiva. Sus piezas sin vender se borran
 * y los gastos asociados se conservan como gastos generales (sin vehículo).
 */
export async function deleteVehicle(id: string): Promise<{ error?: string }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const vehicle = await prisma.sourceVehicle.findUnique({
    where: { id },
    select: {
      brand: true,
      model: true,
      parts: { select: { id: true, partTypeId: true, _count: { select: { saleItems: true } } } },
    },
  });
  if (!vehicle) return { error: "El vehículo ya no existe." };

  const sold = vehicle.parts.filter((p) => p._count.saleItems > 0).length;
  if (sold > 0) {
    return {
      error: `${vehicle.brand} ${vehicle.model} tiene ${sold} pieza${sold === 1 ? "" : "s"} vendida${sold === 1 ? "" : "s"}; borrarlo haría perder esas ventas. Cámbiale el estado a "Archivado" desde su página para dejar de usarlo.`,
    };
  }

  const partIds = vehicle.parts.map((p) => p.id);
  const typeIds = [...new Set(vehicle.parts.map((p) => p.partTypeId))];

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.expense.updateMany({ where: { sourceVehicleId: id }, data: { sourceVehicleId: null } });
        await tx.part.deleteMany({ where: { id: { in: partIds } } });
        // Tipos de texto libre que se quedaron sin piezas
        await tx.partType.deleteMany({ where: { id: { in: typeIds }, catalog: false, parts: { none: {} } } });
        await tx.sourceVehicle.delete({ where: { id } });
      },
      { timeout: 60000, maxWait: 15000 },
    );
  } catch {
    return { error: "No se pudo eliminar el vehículo." };
  }

  revalidatePath("/vehiculos");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  revalidatePath("/finanzas");
  revalidatePath("/ventas");
  revalidatePath("/");
  return {};
}

const inventoryChangeSchema = z.object({
  partTypeId: z.string(),
  qty: z.coerce.number().int().min(0).max(200),
  price: z.coerce.number().min(0),
});

const inventoryExtraSchema = z.object({
  name: z.string().trim().min(1),
  zone: z.enum(["INTERIOR", "MECHANICAL", "EXTERIOR", "DOCUMENTS", "SCRAP", "COMPLETE"]),
  qty: z.coerce.number().int().min(1).max(50),
  price: z.coerce.number().min(0),
});

export async function saveVehicleInventory(
  vehicleId: string,
  payload: string,
): Promise<{ error?: string; created?: number; removed?: number }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  let changes: z.infer<typeof inventoryChangeSchema>[] = [];
  let extras: z.infer<typeof inventoryExtraSchema>[] = [];
  try {
    const parsed = JSON.parse(payload);
    changes = z.array(inventoryChangeSchema).parse(parsed.changes ?? []);
    extras = z.array(inventoryExtraSchema).parse(parsed.extras ?? []);
  } catch {
    return { error: "Hay datos inválidos en la lista de piezas." };
  }

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const zoneFallback = {
    INTERIOR: "Interior",
    MECHANICAL: "Motor",
    EXTERIOR: "Carrocería",
    DOCUMENTS: "Documentos",
    SCRAP: "Chatarra",
    COMPLETE: "Otro",
  } as const;

  let created = 0;
  let removed = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        const vehicle = await tx.sourceVehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle) throw new Error("El vehículo ya no existe.");
        const business = vehicle.business;

        const newParts: { partTypeId: string; categoryName: string; price: number; cost: number }[] = [];

        for (const change of changes) {
          const type = await tx.partType.findUnique({
            where: { id: change.partTypeId },
            include: { category: true },
          });
          if (!type) continue;

          const available = await tx.part.findMany({
            where: { sourceVehicleId: vehicleId, partTypeId: change.partTypeId, status: "AVAILABLE" },
            orderBy: { createdAt: "asc" },
          });

          if (change.qty < available.length) {
            const drop = available.slice(change.qty).map((p) => p.id);
            await tx.part.deleteMany({ where: { id: { in: drop } } });
            removed += drop.length;
          }

          const keep = available.slice(0, change.qty);
          const priceChanged = keep.filter((p) => Number(p.price) !== change.price);
          if (priceChanged.length) {
            await tx.priceHistory.createMany({
              data: priceChanged
                .filter((p) => Number(p.price) > 0)
                .map((p) => ({ partId: p.id, oldPrice: p.price, newPrice: change.price })),
            });
            await tx.part.updateMany({
              where: { id: { in: priceChanged.map((p) => p.id) } },
              data: { price: change.price },
            });
          }

          for (let i = keep.length; i < change.qty; i++) {
            newParts.push({
              partTypeId: type.id,
              categoryName: type.category.name,
              price: change.price,
              cost: Number(available[0]?.cost ?? 0),
            });
          }
        }

        for (const extra of extras) {
          let categoryName = inferCategory(extra.name);
          if (categoryName === "Otro") categoryName = zoneFallback[extra.zone];
          const category = categoryByName.get(categoryName) ?? categoryByName.get("Otro");
          if (!category) throw new Error("No hay categorías configuradas.");
          const type = await tx.partType.create({
            data: { business, name: extra.name, categoryId: category.id, zone: extra.zone, catalog: false, kept: true },
          });
          for (let i = 0; i < extra.qty; i++) {
            newParts.push({ partTypeId: type.id, categoryName: category.name, price: extra.price, cost: 0 });
          }
        }

        if (newParts.length) {
          const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('part_sku_seq') AS n FROM generate_series(1, ${newParts.length})`;
          await tx.part.createMany({
            data: newParts.map((p, i) => ({
              business,
              sku: `${categoryCode(p.categoryName)}-${seq[i].n.toString().padStart(6, "0")}`,
              partTypeId: p.partTypeId,
              sourceVehicleId: vehicleId,
              price: p.price,
              cost: p.cost,
            })),
          });
          created = newParts.length;
        }
      },
      { timeout: 60000, maxWait: 15000 },
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudieron guardar los cambios." };
  }

  revalidatePath(`/vehiculos/${vehicleId}`);
  revalidatePath("/vehiculos");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  return { created, removed };
}
