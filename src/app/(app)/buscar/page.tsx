import { prisma } from "@/lib/prisma";
import { SearchClient } from "./search-client";

export default async function BuscarPage() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buscar pieza</h1>
        <p className="text-sm text-muted-foreground">
          Busca por nombre, marca, modelo, año, categoría o SKU. Resultados al instante.
        </p>
      </div>
      <SearchClient categories={categories} />
    </div>
  );
}
