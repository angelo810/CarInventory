import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchPartTypes } from "@/lib/search";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const brand = searchParams.get("brand") ?? undefined;
  const model = searchParams.get("model") ?? undefined;
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const status = (searchParams.get("status") as "ALL" | null) ?? undefined;

  const results = await searchPartTypes({
    q,
    brand,
    model,
    year,
    categoryId,
    status: status ?? undefined,
  });

  return NextResponse.json({ results });
}
