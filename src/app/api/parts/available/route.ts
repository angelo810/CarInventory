import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const parts = await prisma.part.findMany({
    where: {
      status: "AVAILABLE",
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { partType: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { partType: true },
    take: 15,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    results: parts.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.partType.name,
      price: p.price.toString(),
      condition: p.condition,
    })),
  });
}
