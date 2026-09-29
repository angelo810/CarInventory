"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateSku } from "@/lib/sku";
import { PartCondition, PartStatus } from "@/generated/prisma/enums";
import { assertAdmin } from "@/lib/auth-guard";
import { getActiveBusiness } from "@/lib/business";

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
  const business = await getActiveBusiness();

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
        business,
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
      business,
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
  partTypeId: z.string().min(1, "Elige un tipo de pieza"),
  sourceVehicleId: z.string().optional(),
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

  const newType = await prisma.partType.findUnique({ where: { id: data.partTypeId } });
  if (!newType) return { error: "Ese tipo de pieza ya no existe." };

  if (data.sourceVehicleId) {
    const vehicle = await prisma.sourceVehicle.findUnique({ where: { id: data.sourceVehicleId } });
    if (!vehicle) return { error: "Ese vehículo ya no existe." };
  }

  const oldTypeId = current.partTypeId;

  await prisma.$transaction(async (tx) => {
    if (Number(current.price) !== data.price) {
      await tx.priceHistory.create({
        data: { partId, oldPrice: current.price, newPrice: data.price },
      });
    }

    await tx.part.update({
      where: { id: partId },
      data: {
        partTypeId: data.partTypeId,
        sourceVehicleId: data.sourceVehicleId || null,
        condition: data.condition,
        status: data.status,
        location: data.location || null,
        price: data.price,
        cost: data.cost,
        notes: data.notes || null,
      },
    });

    // Si se cambió a otro tipo y el anterior era un texto libre (no catálogo) que se quedó sin
    // unidades, se borra para no dejar tipos huérfanos.
    if (oldTypeId !== data.partTypeId) {
      await tx.partType.deleteMany({ where: { id: oldTypeId, catalog: false, parts: { none: {} } } });
    }
  });

  revalidatePath(`/piezas/${partId}`);
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  revalidatePath("/piezas/tipos");
  if (current.sourceVehicleId) revalidatePath(`/vehiculos/${current.sourceVehicleId}`);
  if (data.sourceVehicleId) revalidatePath(`/vehiculos/${data.sourceVehicleId}`);
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
  zone: "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE" | "OTHER",
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

export async function renamePartType(id: string, name: string): Promise<{ error?: string; mergedInto?: string }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const newName = name.trim();
  if (!newName) return { error: "El nombre no puede estar vacío." };

  const type = await prisma.partType.findUnique({ where: { id } });
  if (!type) return { error: "No encontré esa pieza." };
  if (newName === type.name) return {};

  const clash = await prisma.partType.findFirst({
    where: { id: { not: id }, business: type.business, name: { equals: newName, mode: "insensitive" } },
  });

  if (clash) {
    // Ya existe un tipo con ese nombre: fusiona esta pieza (y sus unidades) en esa.
    await prisma.$transaction([
      prisma.part.updateMany({ where: { partTypeId: id }, data: { partTypeId: clash.id } }),
      prisma.partCompatibility.deleteMany({ where: { partTypeId: id } }),
      prisma.partType.delete({ where: { id } }),
    ]);
    revalidatePath("/piezas");
    revalidatePath("/piezas/tipos");
    revalidatePath("/piezas/nuevo");
    revalidatePath("/vehiculos");
    revalidatePath("/ventas");
    revalidatePath("/ventas/revisar");
    return { mergedInto: clash.name };
  }

  await prisma.partType.update({ where: { id }, data: { name: newName } });
  revalidatePath("/piezas");
  revalidatePath("/piezas/tipos");
  revalidatePath("/piezas/nuevo");
  revalidatePath("/vehiculos");
  revalidatePath("/ventas");
  revalidatePath("/ventas/revisar");
  return {};
}

/**
 * Quita un tipo de pieza del catálogo por completo (para estandarizar nombres duplicados,
 * ej. "Switch" cuando ya existe "Switch encendido"). Solo se permite si nunca se usó en
 * ninguna pieza física; si ya se usó, hay que fusionarla desde "Organizar tipos" en vez de
 * borrarla, para no perder el historial de esas piezas.
 */
export async function deletePartType(id: string): Promise<{ error?: string }> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const type = await prisma.partType.findUnique({
    where: { id },
    select: { name: true, _count: { select: { parts: true } } },
  });
  if (!type) return { error: "No encontré esa pieza." };
  if (type._count.parts > 0) {
    return {
      error: `"${type.name}" ya se usó en ${type._count.parts} pieza${type._count.parts === 1 ? "" : "s"}. Usa el botón "Fusionar" (junto al de quitar) para unificarla con otra pieza sin perder ese historial.`,
    };
  }

  await prisma.partType.delete({ where: { id } });
  revalidatePath("/piezas");
  revalidatePath("/piezas/tipos");
  revalidatePath("/piezas/nuevo");
  revalidatePath("/vehiculos");
  revalidatePath("/ventas");
  revalidatePath("/ventas/revisar");
  return {};
}
