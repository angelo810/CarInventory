"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createSale } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { PaymentMethod } from "@/generated/prisma/enums";

type AvailablePart = { id: string; sku: string; name: string; price: string; condition: string };
type SaleItem = AvailablePart & { priceSold: string };

export function SaleForm() {
  const [state, formAction, isPending] = useActionState(createSale, undefined);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AvailablePart[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);

  useEffect(() => {
    if (!query.trim()) return;

    const timeout = setTimeout(() => {
      fetch(`/api/parts/available?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setSuggestions(d.results ?? []));
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) setSuggestions([]);
  }

  const total = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.priceSold) || 0), 0),
    [items],
  );

  const itemsJson = JSON.stringify(items.map((i) => ({ partId: i.id, priceSold: i.priceSold })));

  function addItem(part: AvailablePart) {
    if (items.some((i) => i.id === part.id)) return;
    setItems((prev) => [...prev, { ...part, priceSold: part.price }]);
    setQuery("");
    setSuggestions([]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updatePriceSold(id: string, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, priceSold: value } : i)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items" value={itemsJson} />

      <Card>
        <CardHeader>
          <CardTitle>Piezas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder="Buscar pieza disponible por nombre o SKU…"
              className="pl-9"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => addItem(s)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{s.sku}</span>
                      {s.name}
                    </span>
                    <span className="font-medium">{formatCurrency(s.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{item.sku}</span>
                  {item.name}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={item.priceSold}
                  onChange={(e) => updatePriceSold(item.id, e.target.value)}
                  className="w-28"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No has agregado piezas todavía.</p>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex justify-end text-lg font-semibold">Total: {formatCurrency(total)}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cliente y pago</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Nombre del cliente (opcional)</Label>
            <Input id="customerName" name="customerName" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Teléfono</Label>
            <Input id="customerPhone" name="customerPhone" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerIdNumber">Cédula / RUC</Label>
            <Input id="customerIdNumber" name="customerIdNumber" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Forma de pago</Label>
            <Select name="paymentMethod" defaultValue={PaymentMethod.CASH} items={paymentMethodLabels}>
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
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || items.length === 0}>
          {isPending ? "Registrando…" : "Registrar venta"}
        </Button>
      </div>
    </form>
  );
}
