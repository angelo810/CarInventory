"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PaymentMethod } from "@/generated/prisma/enums";

const itemSchema = z.object({
  partId: z.string(),
  priceSold: z.coerce.number().min(0),
});

const saleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerIdNumber: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  notes: z.string().optional(),
  items: z.string(), // JSON
});

export type SaleFormState = { error?: string };

export async function createSale(
  _prevState: SaleFormState | undefined,
  formData: FormData,
): Promise<SaleFormState> {
  const parsed = saleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  const data = parsed.data;

  let items: z.infer<typeof itemSchema>[];
  try {
    items = z.array(itemSchema).min(1).parse(JSON.parse(data.items));
  } catch {
    return { error: "Debes agregar al menos una pieza a la venta." };
  }

  const totalAmount = items.reduce((sum, i) => sum + i.priceSold, 0);

  let saleId: string;
  try {
    saleId = await prisma.$transaction(async (tx) => {
    let customerId: string | undefined;

    if (data.customerName?.trim()) {
      const customer = await tx.customer.create({
        data: {
          name: data.customerName.trim(),
          phone: data.customerPhone || null,
          idNumber: data.customerIdNumber || null,
        },
      });
      customerId = customer.id;
    }

    const parts = await tx.part.findMany({ where: { id: { in: items.map((i) => i.partId) } } });
    const unavailable = parts.filter((p) => p.status !== "AVAILABLE");
    if (unavailable.length > 0) {
      throw new Error("Alguna de las piezas seleccionadas ya no está disponible.");
    }
    if (parts.length !== items.length) {
      throw new Error("Alguna de las piezas seleccionadas ya no existe.");
    }

    const sale = await tx.sale.create({
      data: {
        customerId,
        paymentMethod: data.paymentMethod,
        totalAmount,
        notes: data.notes || null,
        items: {
          create: items.map((i) => ({ partId: i.partId, priceSold: i.priceSold })),
        },
      },
    });

    for (const item of items) {
      await tx.part.update({ where: { id: item.partId }, data: { status: "SOLD" } });
    }

    return sale.id;
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "No se pudo registrar la venta." };
  }

  revalidatePath("/ventas");
  revalidatePath("/piezas");
  revalidatePath("/buscar");
  redirect(`/ventas/${saleId}`);
}
