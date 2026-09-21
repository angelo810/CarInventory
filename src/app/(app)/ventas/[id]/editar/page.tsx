import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SaleEditForm } from "./sale-edit-form";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditarVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [sale, employees, vehicles, categories] = await Promise.all([
    prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { part: { include: { partType: true } } } } },
    }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.sourceVehicle.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }] }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!sale) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar venta</h1>
        <p className="text-sm text-muted-foreground">
          Corrige fecha, empleado, piezas, auto y precio. El total se recalcula solo.
        </p>
      </div>
      <SaleEditForm
        saleId={sale.id}
        saleDate={toLocalInput(sale.saleDate)}
        employeeId={sale.employeeId ?? ""}
        paymentMethod={sale.paymentMethod}
        notes={sale.notes ?? ""}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model}` }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        items={sale.items.map((i) => ({
          itemId: i.id,
          sku: i.part.sku,
          name: i.part.partType.name,
          categoryId: i.part.partType.categoryId,
          sourceVehicleId: i.part.sourceVehicleId ?? "",
          priceSold: i.priceSold.toString(),
        }))}
      />
    </div>
  );
}
