import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { sourceVehicleStatusLabels } from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function VehiculosPage() {
  const vehicles = await prisma.sourceVehicle.findMany({
    orderBy: { purchaseDate: "desc" },
    include: { _count: { select: { parts: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehículos de origen</h1>
          <p className="text-sm text-muted-foreground">
            Vehículos comprados para desmantelar y extraer piezas.
          </p>
        </div>
        <Button render={<Link href="/vehiculos/nuevo" />} nativeButton={false}>
          <Plus className="size-4" />
          Nuevo vehículo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Compra</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Piezas</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/vehiculos/${v.id}`} className="font-medium hover:underline">
                      {v.brand} {v.model}
                    </Link>
                    {v.vin && <div className="text-xs text-muted-foreground">VIN: {v.vin}</div>}
                  </TableCell>
                  <TableCell>{v.year}</TableCell>
                  <TableCell>{formatDate(v.purchaseDate)}</TableCell>
                  <TableCell>{formatCurrency(v.purchaseCost.toString())}</TableCell>
                  <TableCell>{v._count.parts}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sourceVehicleStatusLabels[v.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No hay vehículos registrados todavía.
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
