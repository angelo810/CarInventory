"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth-guard";
import { QuoteStatus } from "@/generated/prisma/enums";

const WHATSAPP_NUMBER = process.env.WHATSAPP_QUOTE_NUMBER;

export async function createQuote(description: string): Promise<{ error?: string; whatsappUrl?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "No autenticado." };

  const text = description.trim();
  if (!text) return { error: "Escribe qué pieza necesitas." };
  if (text.length > 500) return { error: "Máximo 500 caracteres." };

  await prisma.quote.create({
    data: { description: text, requesterId: session.user.id },
  });
  revalidatePath("/cotizaciones");

  if (!WHATSAPP_NUMBER) {
    return { error: "Se guardó la solicitud, pero falta configurar el número de WhatsApp en el servidor." };
  }

  const who = session.user.name || session.user.email;
  const message = `Un vendedor solicita imágenes y cotización de la pieza: ${text}\n\n— Solicitado por ${who}`;
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  return { whatsappUrl };
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<{ error?: string }> {
  const denied = await assertAdmin();
  if (denied) return denied;
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath("/cotizaciones");
  return {};
}
