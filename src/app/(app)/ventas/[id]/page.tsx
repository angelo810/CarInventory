import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { PrintButton } from "./print-button";

export default async function VentaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { part: { include: { partType: true } } } },
    },
  });

  if (!sale) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Comprobante de venta</h1>
        <PrintButton />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6" id="receipt">
          <div className="flex justify-between">
            <div>
              <h2 className="font-semibold text-lg">CarInventory</h2>
              <p className="text-sm text-muted-foreground">Comprobante de venta</p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{formatDateTime(sale.saleDate)}</p>
              <p>Venta #{sale.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          <div className="text-sm">
            <p className="font-medium">Cliente</p>
            <p className="text-muted-foreground">
              {sale.customer?.name ?? "Cliente sin registrar"}
              {sale.customer?.phone && ` · ${sale.customer.phone}`}
              {sale.customer?.idNumber && ` · ${sale.customer.idNumber}`}
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">SKU</th>
                <th className="py-2">Pieza</th>
                <th className="py-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 font-mono text-xs">{item.part.sku}</td>
                  <td className="py-2">{item.part.partType.name}</td>
                  <td className="py-2 text-right">{formatCurrency(item.priceSold.toString())}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>{formatCurrency(sale.totalAmount.toString())}</span>
          </div>

          <p className="text-sm text-muted-foreground">
            Forma de pago: {paymentMethodLabels[sale.paymentMethod]}
          </p>

          {sale.notes && <p className="text-sm text-muted-foreground">Notas: {sale.notes}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
