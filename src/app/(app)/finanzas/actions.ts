"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ExpenseCategory } from "@/generated/prisma/enums";

const expenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.coerce.number().min(0),
  date: z.string().min(1),
  sourceVehicleId: z.string().optional(),
});

export type ExpenseFormState = { error?: string };

export async function createExpense(
  _prevState: ExpenseFormState | undefined,
  formData: FormData,
): Promise<ExpenseFormState> {
  const raw = Object.fromEntries(formData);
  const parsed = expenseSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: "Datos inválidos, revisa el formulario." };
  }

  const data = parsed.data;

  await prisma.expense.create({
    data: {
      category: data.category,
      description: data.description,
      amount: data.amount,
      date: new Date(`${data.date}T12:00:00`),
      sourceVehicleId: data.sourceVehicleId || null,
    },
  });

  revalidatePath("/finanzas");
  if (data.sourceVehicleId) revalidatePath(`/vehiculos/${data.sourceVehicleId}`);
  return {};
}
