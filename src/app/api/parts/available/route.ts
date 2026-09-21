import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Piezas disponibles agrupadas por (tipo de pieza, vehículo) para el formulario de ventas.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const vehicleId = searchParams.get("vehicleId") ?? "";

  if (!q && !vehicleId) {
    return NextResponse.json({ results: [] });
  }

  const tokens = q.split(/\s+/).filter(Boolean);

  const parts = await prisma.part.findMany({
    where: {
      status: "AVAILABLE",
      ...(vehicleId ? { sourceVehicleId: vehicleId } : {}),
      AND: tokens.map((t) => ({
        OR: [
          { sku: { contains: t, mode: "insensitive" as const } },
          { partType: { name: { contains: t, mode: "insensitive" as const } } },
          { sourceVehicle: { brand: { contains: t, mode: "insensitive" as const } } },
          { sourceVehicle: { model: { contains: t, mode: "insensitive" as const } } },
        ],
      })),
    },
    include: { partType: true, sourceVehicle: true },
    take: 300,
    orderBy: [{ partType: { name: "asc" } }, { createdAt: "asc" }],
  });

  const groups = new Map<
    string,
    { key: string; name: string; vehicle: string; price: string; ids: string[] }
  >();
  for (const p of parts) {
    const key = `${p.partTypeId}:${p.sourceVehicleId ?? "-"}:${p.price.toString()}`;
    const g = groups.get(key) ?? {
      key,
      name: p.partType.name,
      vehicle: p.sourceVehicle ? `${p.sourceVehicle.brand} ${p.sourceVehicle.model}` : "Sin auto",
      price: p.price.toString(),
      ids: [],
    };
    g.ids.push(p.id);
    groups.set(key, g);
  }

  return NextResponse.json({ results: [...groups.values()].slice(0, 25) });
}
