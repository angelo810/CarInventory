"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateSku } from "@/lib/sku";
import { PartCondition, PartStatus } from "@/generated/prisma/enums";
import { assertAdmin } from "@/lib/auth-guard";

const compatibilitySchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  yearFrom: z.coerce.number().int(),
  yearTo: z.coerce.number().int(),
});

const partSchema = z.object({
  partTypeId: z.string().optional(),
  newTypeName: z.string().optional(),
  newTypeCategoryId: z.string().optional(),
  newTypeDescription: z.string().optional(),
  compatibilities: z.string().optional(), // JSON string
  sourceVehicleId: z.string().optional(),
  condition: z.nativeEnum(PartCondition),
  status: z.nativeEnum(PartStatus),
  location: z.string().optional(),
  cost: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export type PartFormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function createPart(
  _prevState: PartFormState | undefined,
  formData: FormData,
): Promise<PartFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const parsed = partSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  let partTypeId = data.partTypeId;

  if (!partTypeId) {
    if (!data.newTypeName || !data.newTypeCategoryId) {
      return { error: "Debes seleccionar un tipo de pieza existente o crear uno nuevo." };
    }

    let compatibilities: z.infer<typeof compatibilitySchema>[] = [];
    if (data.compatibilities) {
      try {
        compatibilities = z.array(compatibilitySchema).parse(JSON.parse(data.compatibilities));
      } catch {
        return { error: "Compatibilidades inválidas." };
      }
    }

    const newType = await prisma.partType.create({
      data: {
        name: data.newTypeName,
        categoryId: data.newTypeCategoryId,
        description: data.newTypeDescription || null,
        compatibilities: { create: compatibilities },
      },
    });
    partTypeId = newType.id;
  }

  const partType = await prisma.partType.findUnique({
    where: { id: partTypeId },
    include: { category: true },
  });

  if (!partType) {
    return { error: "Tipo de pieza no encontrado." };
  }

  const sku = await generateSku(partType.category.name);

  const part = await prisma.part.create({
    data: {
      sku,
      partTypeId,
      sourceVehicleId: data.sourceVehicleId || null,
      condition: data.condition,
      status: data.status,
      location: data.location || null,
      cost: data.cost,
      price: data.price,
      notes: data.notes || null,
    },
  });

  revalidatePath("/piezas");
  revalidatePath("/buscar");
  if (data.sourceVehicleId) revalidatePath(`/vehiculos/${data.sourceVehicleId}`);
  redirect(`/piezas/${part.id}`);
}

const updateSchema = z.object({
  condition: z.nativeEnum(PartCondition),
  status: z.nativeEnum(PartStatus),
  location: z.string().optional(),
  price: z.coerce.number().min(0),
  cost: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export async function updatePart(
  partId: string,
  _prevState: PartFormState | undefined,
  formData: FormData,
): Promise<PartFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  const current = await prisma.part.findUnique({ where: { id: partId } });
  if (!current) return { error: "Pieza no encontrada." };

  await prisma.$transaction(async (tx) => {
    if (Number(current.price) !== data.price) {
      await tx.priceHistory.create({
        data: { partId, oldPrice: current.price, newPrice: data.price },
      });
    }

    await tx.part.update({
      where: { id: partId },
      data: {
        condition: data.condition,
        status: data.status,
        location: data.location || null,
        price: data.price,
        cost: data.cost,
        notes: data.notes || null,
      },
    });
  });

  revalidatePath(`/piezas/${partId}`);
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  return {};
}

export async function addPhoto(partId: string, url: string) {
  if (await assertAdmin()) return;
  await prisma.photo.create({ data: { partId, url } });
  revalidatePath(`/piezas/${partId}`);
}

export async function removePhoto(photoId: string, partId: string) {
  if (await assertAdmin()) return;
  await prisma.photo.delete({ where: { id: photoId } });
  revalidatePath(`/piezas/${partId}`);
}

export async function movePartType(
  id: string,
  zone: "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "OTHER",
): Promise<{ error?: string }> {
  const denied = await assertAdmin();
  if (denied) return denied;
  const type = await prisma.partType.findUnique({ where: { id }, select: { id: true } });
  if (!type) return { error: "No encontré esa pieza." };
  await prisma.partType.update({
    where: { id },
    data: zone === "OTHER" ? { zone: null, catalog: false } : { zone, catalog: true },
  });
  revalidatePath("/piezas");
  revalidatePath("/piezas/nuevo");
  revalidatePath("/piezas/tipos");
  revalidatePath("/vehiculos");
  revalidatePath("/ventas");
  revalidatePath("/ventas/revisar");
  return {};
}
