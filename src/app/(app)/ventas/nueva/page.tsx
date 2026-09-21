import { prisma } from "@/lib/prisma";
import { SaleForm } from "./sale-form";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function NuevaVentaPage() {
  const [employees, vehicles] = await Promise.all([
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.sourceVehicle.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva venta</h1>
        <p className="text-sm text-muted-foreground">
          Registra qué se vendió, de qué auto, a qué precio y quién lo vendió.
        </p>
      </div>
      <SaleForm
        defaultDate={toLocalInput(new Date())}
        employees={employees.map((e) => ({ id: e.id, name: e.name }))}
        vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.brand} ${v.model}` }))}
      />
    </div>
  );
}
