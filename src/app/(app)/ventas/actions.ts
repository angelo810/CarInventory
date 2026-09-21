"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentMethod } from "@/generated/prisma/enums";
import { generateSku } from "@/lib/sku";
import { inferCategory } from "@/lib/categorize";

const newItemSchema = z
  .object({
    partId: z.string().optional(),
    name: z.string().trim().optional(),
    sourceVehicleId: z.string().optional(),
    priceSold: z.coerce.number().min(0),
  })
  .refine((i) => i.partId || i.name);

const saleSchema = z.object({
  saleDate: z.string().min(1),
  employeeId: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  notes: z.string().optional(),
  items: z.string(),
});

const FREE_SALE_NOTE = "Registrada al vender (sin inventario)";

export type SaleFormState = { error?: string };

const editItemSchema = z.object({
  itemId: z.string(),
  name: z.string().min(1),
  categoryId: z.string(),
  sourceVehicleId: z.string().optional(),
  priceSold: z.coerce.number().min(0),
});

const editSaleSchema = z.object({
  saleDate: z.string().min(1),
  employeeId: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  notes: z.string().optional(),
  items: z.string(),
});

export async function updateSale(
  saleId: string,
  _prevState: SaleFormState | undefined,
  formData: FormData,
): Promise<SaleFormState> {
  const parsed = editSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const data = parsed.data;

  let items: z.infer<typeof editItemSchema>[];
  try {
    items = z.array(editItemSchema).min(1).parse(JSON.parse(data.items));
  } catch {
    return { error: "Revisa los datos de las piezas (nombre, categoría y precio)." };
  }

  const saleDate = new Date(data.saleDate);
  if (Number.isNaN(saleDate.getTime())) return { error: "Fecha inválida." };

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const saleItem = await tx.saleItem.findUnique({
          where: { id: item.itemId },
          include: { part: { include: { partType: true } } },
        });
        if (!saleItem || saleItem.saleId !== saleId) throw new Error("Pieza no encontrada en la venta.");

        const partType = saleItem.part.partType;
        let partTypeId = partType.id;
        if (partType.name !== item.name || partType.categoryId !== item.categoryId) {
          const shared = partType.catalog || (await tx.part.count({ where: { partTypeId: partType.id } })) > 1;
          if (shared) {
            const created = await tx.partType.create({
              data: { name: item.name, categoryId: item.categoryId },
            });
            partTypeId = created.id;
          } else {
            await tx.partType.update({
              where: { id: partType.id },
              data: { name: item.name, categoryId: item.categoryId },
            });
          }
        }

        await tx.part.update({
          where: { id: saleItem.partId },
          data: { partTypeId, sourceVehicleId: item.sourceVehicleId || null },
        });
        await tx.saleItem.update({ where: { id: item.itemId }, data: { priceSold: item.priceSold } });
      }

      await tx.sale.update({
        where: { id: saleId },
        data: {
          saleDate,
          employeeId: data.employeeId || null,
          paymentMethod: data.paymentMethod,
          notes: data.notes || null,
          totalAmount: items.reduce((sum, i) => sum + i.priceSold, 0),
        },
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath(`/ventas/${saleId}`);
  revalidatePath("/finanzas");
  revalidatePath("/");
  redirect("/ventas");
}

export async function createSale(
  _prevState: SaleFormState | undefined,
  formData: FormData,
): Promise<SaleFormState> {
  const parsed = saleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos." };
  const data = parsed.data;

  let items: z.infer<typeof newItemSchema>[];
  try {
    items = z.array(newItemSchema).min(1).parse(JSON.parse(data.items));
  } catch {
    return { error: "Cada pieza necesita una descripción (o elegirse del inventario) y un precio." };
  }

  const saleDate = new Date(data.saleDate);
  if (Number.isNaN(saleDate.getTime())) return { error: "Fecha inválida." };

  const partIds = items.map((i) => i.partId).filter((id): id is string => Boolean(id));
  if (new Set(partIds).size !== partIds.length) return { error: "Una pieza del inventario está repetida." };

  const inventoryParts = partIds.length
    ? await prisma.part.findMany({ where: { id: { in: partIds } }, include: { partType: true } })
    : [];
  const partById = new Map(inventoryParts.map((p) => [p.id, p]));
  for (const id of partIds) {
    const p = partById.get(id);
    if (!p) return { error: "Una pieza del inventario ya no existe." };
    if (p.status !== "AVAILABLE") return { error: `La pieza ${p.sku} (${p.partType.name}) ya no está disponible.` };
  }

  const categories = await prisma.category.findMany();
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  const fallbackId = categoryByName.get("Otro") ?? categories[0]?.id;
  if (!fallbackId) return { error: "No hay categorías configuradas." };

  type Entry =
    | { kind: "part"; partId: string; priceSold: number; vehicleKey: string }
    | { kind: "text"; name: string; priceSold: number; vehicleKey: string; sourceVehicleId: string; categoryId: string; sku: string };

  const entries: Entry[] = [];
  for (const item of items) {
    if (item.partId) {
      const p = partById.get(item.partId)!;
      entries.push({ kind: "part", partId: p.id, priceSold: item.priceSold, vehicleKey: p.sourceVehicleId ?? "__none__" });
    } else {
      const categoryName = inferCategory(item.name!);
      entries.push({
        kind: "text",
        name: item.name!,
        priceSold: item.priceSold,
        vehicleKey: item.sourceVehicleId || "__none__",
        sourceVehicleId: item.sourceVehicleId || "",
        categoryId: categoryByName.get(categoryName) ?? fallbackId,
        sku: await generateSku(categoryName),
      });
    }
  }

  // Una venta por auto: las piezas del mismo auto van juntas, cada auto distinto es otra venta.
  const byVehicle = new Map<string, Entry[]>();
  for (const e of entries) byVehicle.set(e.vehicleKey, [...(byVehicle.get(e.vehicleKey) ?? []), e]);

  let firstId = "";
  try {
    firstId = await prisma.$transaction(async (tx) => {
      let first = "";
      for (const group of byVehicle.values()) {
        const sale = await tx.sale.create({
          data: {
            saleDate,
            employeeId: data.employeeId || null,
            paymentMethod: data.paymentMethod,
            totalAmount: group.reduce((sum, e) => sum + e.priceSold, 0),
            notes: data.notes || null,
          },
        });
        first ||= sale.id;

        for (const e of group) {
          if (e.kind === "part") {
            const updated = await tx.part.updateMany({
              where: { id: e.partId, status: "AVAILABLE" },
              data: { status: "SOLD" },
            });
            if (updated.count !== 1) throw new Error("Una pieza del inventario ya fue vendida.");
            await tx.saleItem.create({ data: { saleId: sale.id, partId: e.partId, priceSold: e.priceSold } });
          } else {
            const partType = await tx.partType.create({ data: { name: e.name, categoryId: e.categoryId } });
            const part = await tx.part.create({
              data: {
                sku: e.sku,
                partTypeId: partType.id,
                sourceVehicleId: e.sourceVehicleId || null,
                status: "SOLD",
                cost: 0,
                price: e.priceSold,
                notes: FREE_SALE_NOTE,
              },
            });
            await tx.saleItem.create({ data: { saleId: sale.id, partId: part.id, priceSold: e.priceSold } });
          }
        }
      }
      return first;
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo registrar la venta." };
  }

  void firstId;
  revalidatePath("/ventas");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  revalidatePath("/vehiculos");
  revalidatePath("/finanzas");
  revalidatePath("/");
  redirect("/ventas");
}

export async function deleteSale(saleId: string): Promise<SaleFormState> {
  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { part: { include: { partType: true } } } } },
      });
      if (!sale) throw new Error("La venta ya no existe.");

      await tx.sale.delete({ where: { id: saleId } });

      for (const { part } of sale.items) {
        const migrated =
          sale.notes?.includes("Migrado de WhatsApp") ||
          part.partType.description?.includes("Migrado de WhatsApp") ||
          part.notes === FREE_SALE_NOTE;
        if (migrated) {
          await tx.part.delete({ where: { id: part.id } });
          const remaining = await tx.part.count({ where: { partTypeId: part.partTypeId } });
          if (remaining === 0 && !part.partType.catalog) await tx.partType.delete({ where: { id: part.partTypeId } });
        } else {
          await tx.part.update({ where: { id: part.id }, data: { status: "AVAILABLE" } });
        }
      }
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo eliminar la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  revalidatePath("/finanzas");
  revalidatePath("/");
  return {};
}
