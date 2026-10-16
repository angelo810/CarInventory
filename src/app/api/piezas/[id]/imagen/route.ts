import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Entrega la foto de una pieza del catálogo (almacén privado de Vercel Blob) solo a usuarios con sesión.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const type = await prisma.partType.findUnique({ where: { id }, select: { imageUrl: true } });
  if (!type?.imageUrl) return new NextResponse(null, { status: 404 });

  try {
    const result = await get(type.imageUrl, { access: "private" });
    if (!result || result.statusCode !== 200) return new NextResponse(null, { status: 404 });
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType,
        // la URL lleva ?v=..., así que una foto nueva se pide de nuevo sola
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
