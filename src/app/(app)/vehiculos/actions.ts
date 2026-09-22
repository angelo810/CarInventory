"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inferCategory } from "@/lib/categorize";
import { categoryCode } from "@/lib/sku";
import { assertAdmin } from "@/lib/auth-guard";

const vehicleSchema = z.object({
  brand: z.string().min(1, "Marca requerida"),
  model: z.string().min(1, "Modelo requerido"),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  engine: z.string().optional(),
  vin: z.string().optional(),
  purchaseDate: z.string().min(1, "Fecha requerida"),
  purchaseCost: z.coerce.number().min(0),
  condition: z.string().optional(),
  notes: z.string().optional(),
  checklist: z.string().optional(), // JSON: [[partTypeId, cantidad], ...]
  extras: z.string().optional(), // JSON: [{ name, zone, qty, addToCatalog }]
});

const extraSchema = z.object({
  name: z.string().trim().min(1),
  zone: z.enum(["INTERIOR", "MECHANICAL", "EXTERIOR"]),
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

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  const zoneFallback = { INTERIOR: "Interior", MECHANICAL: "Motor", EXTERIOR: "Carrocería" } as const;

  let vehicleId: string;
  try {
    vehicleId = await prisma.$transaction(
      async (tx) => {
        const vehicle = await tx.sourceVehicle.create({
          data: {
            brand: data.brand,
            model: data.model,
            year: data.year,
            engine: data.engine || null,
            vin: data.vin || null,
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
            where: { id: { in: checklist.map(([id]) => id) } },
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
    return { error: "No se pudo crear el vehículo (verifica que el VIN no esté repetido)." };
  }

  revalidatePath("/vehiculos");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  redirect(`/vehiculos/${vehicleId}`);
}

export async function updateVehicleStatus(id: string, status: "IN_PROGRESS" | "DISMANTLED" | "ARCHIVED") {
  if (await assertAdmin()) return;
  await prisma.sourceVehicle.update({ where: { id }, data: { status } });
  revalidatePath(`/vehiculos/${id}`);
  revalidatePath("/vehiculos");
}

const inventoryChangeSchema = z.object({
  partTypeId: z.string(),
  qty: z.coerce.number().int().min(0).max(200),
  price: z.coerce.number().min(0),
});

const inventoryExtraSchema = z.object({
  name: z.string().trim().min(1),
  zone: z.enum(["INTERIOR", "MECHANICAL", "EXTERIOR"]),
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
  const zoneFallback = { INTERIOR: "Interior", MECHANICAL: "Motor", EXTERIOR: "Carrocería" } as const;

  let created = 0;
  let removed = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        const vehicle = await tx.sourceVehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle) throw new Error("El vehículo ya no existe.");

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
            data: { name: extra.name, categoryId: category.id, zone: extra.zone, catalog: false, kept: true },
          });
          for (let i = 0; i < extra.qty; i++) {
            newParts.push({ partTypeId: type.id, categoryName: category.name, price: extra.price, cost: 0 });
          }
        }

        if (newParts.length) {
          const seq = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('part_sku_seq') AS n FROM generate_series(1, ${newParts.length})`;
          await tx.part.createMany({
            data: newParts.map((p, i) => ({
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
