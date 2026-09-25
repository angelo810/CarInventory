"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { updateSale } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { PaymentMethod } from "@/generated/prisma/enums";
import { DeleteSaleButton } from "../../delete-sale-button";
import { Plus, Trash2 } from "lucide-react";

type Option = { id: string; name: string };
type Item = {
  key: string;
  itemId?: string; // ausente = pieza nueva que se agrega ahora
  sku?: string;
  name: string;
  categoryId: string;
  sourceVehicleId: string;
  priceSold: string;
};

const NONE = "__none__";

export function SaleEditForm({
  saleId,
  saleDate,
  employeeId,
  paymentMethod,
  notes,
  employees,
  vehicles,
  categories,
  items: initialItems,
}: {
  saleId: string;
  saleDate: string;
  employeeId: string;
  paymentMethod: PaymentMethod;
  notes: string;
  employees: Option[];
  vehicles: { id: string; label: string }[];
  categories: Option[];
  items: Omit<Item, "key">[];
}) {
  const [state, formAction, isPending] = useActionState(updateSale.bind(null, saleId), undefined);
  const [items, setItems] = useState<Item[]>(() => initialItems.map((i) => ({ ...i, key: i.itemId! })));
  const [employee, setEmployee] = useState(employeeId || NONE);
  const [vehicle, setVehicle] = useState(initialItems[0]?.sourceVehicleId || NONE);
  const [nextKey, setNextKey] = useState(1);

  const total = useMemo(() => items.reduce((s, i) => s + (Number(i.priceSold) || 0), 0), [items]);

  function patch(key: string, changes: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        key: `new-${nextKey}`,
        name: "",
        categoryId: categories[0]?.id ?? "",
        sourceVehicleId: vehicle === NONE ? "" : vehicle,
        priceSold: "0",
      },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const vehicleItems = { [NONE]: "Sin auto", ...Object.fromEntries(vehicles.map((v) => [v.id, v.label])) };

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((i) => ({
            itemId: i.itemId,
            name: i.name,
            categoryId: i.categoryId,
            sourceVehicleId: vehicle === NONE ? "" : vehicle,
            priceSold: i.priceSold,
          })),
        )}
      />
      <input type="hidden" name="employeeId" value={employee === NONE ? "" : employee} />

      <Card>
        <CardHeader>
          <CardTitle>Piezas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {items.map((item) => (
            <div key={item.key} className="grid sm:grid-cols-2 gap-3 border-b pb-6 last:border-0 last:pb-0">
              <div className="sm:col-span-2 flex items-start justify-between gap-2">
                <Label htmlFor={`name-${item.key}`}>
                  Pieza{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.sku ?? "nueva pieza"}
                  </span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Quitar esta pieza de la venta"
                  onClick={() => removeItem(item.key)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Textarea
                  id={`name-${item.key}`}
                  rows={2}
                  value={item.name}
                  onChange={(e) => patch(item.key, { name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={item.categoryId}
                  items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
                  onValueChange={(v) => v && patch(item.key, { categoryId: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`price-${item.key}`}>Precio (USD)</Label>
                <Input
                  id={`price-${item.key}`}
                  type="number"
                  step="0.01"
                  value={item.priceSold}
                  onChange={(e) => patch(item.key, { priceSold: e.target.value })}
                />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="size-4" />
            Agregar pieza
          </Button>
          <div className="flex justify-end text-lg font-semibold">Total: {formatCurrency(total)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la venta</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="saleDate">Fecha y hora</Label>
            <Input id="saleDate" name="saleDate" type="datetime-local" defaultValue={saleDate} required />
          </div>
          <div className="space-y-2">
            <Label>Auto de origen</Label>
            <Select value={vehicle} items={vehicleItems} onValueChange={(v) => setVehicle(v ?? NONE)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin auto</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vendido por</Label>
            <Select
              value={employee}
              items={{ [NONE]: "Sin especificar", ...Object.fromEntries(employees.map((e) => [e.id, e.name])) }}
              onValueChange={(v) => setEmployee(v ?? NONE)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin especificar</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Forma de pago</Label>
            <Select name="paymentMethod" defaultValue={paymentMethod} items={paymentMethodLabels}>
              <SelectTrigger className="w-full" id="paymentMethod">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PaymentMethod).map((m) => (
                  <SelectItem key={m} value={m}>
                    {paymentMethodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={notes} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center justify-between gap-2">
        <DeleteSaleButton
          saleId={saleId}
          redirectTo="/ventas"
          summary={`${items.map((i) => i.name).join(" · ")} · ${formatCurrency(total)}.`}
        />
        <div className="flex gap-2">
        <Button variant="ghost" render={<Link href="/ventas" />} nativeButton={false}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
        </div>
      </div>
    </form>
  );
}
