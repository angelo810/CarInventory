import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function VentasPage() {
  const sales = await prisma.sale.findMany({
    include: { customer: true, items: true },
    orderBy: { saleDate: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ventas</h1>
          <p className="text-sm text-muted-foreground">Historial de ventas registradas.</p>
        </div>
        <Button render={<Link href="/ventas/nueva" />} nativeButton={false}>
          <Plus className="size-4" />
          Nueva venta
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Piezas</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/ventas/${s.id}`} className="hover:underline">
                      {formatDateTime(s.saleDate)}
                    </Link>
                  </TableCell>
                  <TableCell>{s.customer?.name ?? "—"}</TableCell>
                  <TableCell>{s.items.length}</TableCell>
                  <TableCell>{paymentMethodLabels[s.paymentMethod]}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.totalAmount.toString())}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No hay ventas registradas todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
