"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { assertAdmin } from "@/lib/auth-guard";
import { Role } from "@/generated/prisma/enums";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  name: z.string().trim().optional(),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.nativeEnum(Role),
});

export type UserFormState = { error?: string };

export async function createUser(_prevState: UserFormState | undefined, formData: FormData): Promise<UserFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { error: "Ya existe un usuario con ese correo." };

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: { email: data.email, name: data.name || null, passwordHash, role: data.role },
  });

  revalidatePath("/usuarios");
  return {};
}

export async function updateUserRole(id: string, role: Role): Promise<UserFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  if (role === "SELLER") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === "ADMIN" && admins <= 1) {
      return { error: "Debe quedar al menos un administrador." };
    }
  }

  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/usuarios");
  return {};
}

export async function resetUserPassword(id: string, password: string): Promise<UserFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;
  if (password.length < 6) return { error: "Mínimo 6 caracteres." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  revalidatePath("/usuarios");
  return {};
}

export async function deleteUser(id: string): Promise<UserFormState> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const session = await auth();
  if (session?.user?.id === id) return { error: "No puedes eliminar tu propia cuenta." };

  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return { error: "Debe quedar al menos un administrador." };
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return { error: "No se puede eliminar: tiene cotizaciones registradas a su nombre." };
  }
  revalidatePath("/usuarios");
  return {};
}
