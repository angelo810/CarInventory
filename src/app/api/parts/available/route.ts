import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBusiness } from "@/lib/business";
import { partTypeIdsMatching, vehicleIdsMatching } from "@/lib/accent-search";

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
  const business = await getActiveBusiness();

  // por palabra: ids de piezas y vehículos que la contienen sin importar tildes
  const perToken = await Promise.all(
    tokens.map(async (t) => ({
      token: t,
      typeIds: await partTypeIdsMatching(business, t),
      vehicleIds: await vehicleIdsMatching(business, t),
    })),
  );

  const parts = await prisma.part.findMany({
    where: {
      business,
      status: "AVAILABLE",
      ...(vehicleId ? { sourceVehicleId: vehicleId } : {}),
      AND: perToken.map(({ token, typeIds, vehicleIds }) => ({
        OR: [
          { sku: { contains: token, mode: "insensitive" as const } },
          { partTypeId: { in: typeIds } },
          { sourceVehicleId: { in: vehicleIds } },
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
