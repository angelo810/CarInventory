import { auth } from "@/auth";

/** Usar al inicio de un server action que solo el administrador puede ejecutar. */
export async function assertAdmin(): Promise<{ error: string } | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Solo un administrador puede hacer esto." };
  }
  return null;
}
