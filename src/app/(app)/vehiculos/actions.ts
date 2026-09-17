"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
});

export type VehicleFormState = { error?: string; fieldErrors?: Record<string, string[]> };

export async function createVehicle(
  _prevState: VehicleFormState | undefined,
  formData: FormData,
): Promise<VehicleFormState> {
  const parsed = vehicleSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  let vehicle;
  try {
    vehicle = await prisma.sourceVehicle.create({
      data: {
        brand: data.brand,
        model: data.model,
        year: data.year,
        engine: data.engine || null,
        vin: data.vin || null,
        purchaseDate: new Date(data.purchaseDate),
        purchaseCost: data.purchaseCost,
        condition: data.condition || null,
        notes: data.notes || null,
      },
    });
  } catch {
    return { error: "No se pudo crear el vehículo (verifica que el VIN no esté repetido)." };
  }

  revalidatePath("/vehiculos");
  redirect(`/vehiculos/${vehicle.id}`);
}

export async function updateVehicleStatus(id: string, status: "IN_PROGRESS" | "DISMANTLED" | "ARCHIVED") {
  await prisma.sourceVehicle.update({ where: { id }, data: { status } });
  revalidatePath(`/vehiculos/${id}`);
  revalidatePath("/vehiculos");
}
