"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, PackageCheck, Plus, Search, Trash2 } from "lucide-react";
import { createSale } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/labels";
import { PaymentMethod } from "@/generated/prisma/enums";

type Line = {
  key: number;
  partId?: string; // pieza del inventario
  name: string;
  vehicleLabel?: string;
  sourceVehicleId: string;
  priceSold: string;
};

type Group = { key: string; name: string; vehicle: string; price: string; ids: string[] };

const NONE = "__none__";

export function SaleForm({
  defaultDate,
  employees,
  vehicles,
}: {
  defaultDate: string;
  employees: { id: string; name: string }[];
  vehicles: { id: string; label: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createSale, undefined);
  const [lines, setLines] = useState<Line[]>([]);
  const nextKey = useRef(1);
  const [employee, setEmployee] = useState(NONE);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.priceSold) || 0), 0), [lines]);
  const vehicleItems = { [NONE]: "Sin auto", ...Object.fromEntries(vehicles.map((v) => [v.id, v.label])) };
  const valid = lines.length > 0 && lines.every((l) => (l.partId || l.name.trim()) && l.priceSold !== "");
  const usedIds = new Set(lines.map((l) => l.partId).filter(Boolean));

  function patch(key: number, changes: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  }

  function onQuery(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    if (!value.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(() => {
      fetch(`/api/parts/available?q=${encodeURIComponent(value.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(d.results ?? []))
        .finally(() => setSearching(false));
    }, 250);
  }

  function addFromInventory(group: Group) {
    const partId = group.ids.find((id) => !usedIds.has(id));
    if (!partId) return;
    setLines((prev) => [
      ...prev,
      {
        key: nextKey.current++,
        partId,
        name: group.name,
        vehicleLabel: group.vehicle,
        sourceVehicleId: "",
        priceSold: Number(group.price) > 0 ? group.price : "",
      },
    ]);
  }

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map((l) => ({
            partId: l.partId,
            name: l.partId ? undefined : l.name,
            sourceVehicleId: l.partId ? undefined : l.sourceVehicleId,
            priceSold: l.priceSold,
          })),
        )}
      />
      <input type="hidden" name="employeeId" value={employee === NONE ? "" : employee} />

      <Card>
        <CardHeader>
          <CardTitle>Piezas vendidas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Busca la pieza en el inventario (por nombre, auto o SKU) para marcarla como vendida. Si no está registrada,
            agrégala como pieza libre.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Buscar en inventario: ej. puerta delantera optra 3"
              className="pl-9"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
            )}
            {query.trim() && !searching && (
              <div className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
                {results.map((g) => {
                  const free = g.ids.filter((id) => !usedIds.has(id)).length;
                  return (
                    <button
                      type="button"
                      key={g.key}
                      disabled={free === 0}
                      onClick={() => {
                        addFromInventory(g);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      <span>
                        {g.name}
                        <span className="ml-2 text-muted-foreground">· {g.vehicle}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline">{free} disp.</Badge>
                        <span className="font-medium">{Number(g.price) > 0 ? formatCurrency(g.price) : "sin precio"}</span>
                      </span>
                    </button>
                  );
                })}
                {results.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No hay piezas disponibles con esa búsqueda.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {lines.map((line) =>
              line.partId ? (
                <div key={line.key} className="flex flex-wrap items-center gap-3 rounded-lg border bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/20">
                  <PackageCheck className="size-4 text-emerald-600" />
                  <div className="flex-1 min-w-48 text-sm">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{line.vehicleLabel} · del inventario</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Precio"
                      value={line.priceSold}
                      onChange={(e) => patch(line.key, { priceSold: e.target.value })}
                      className="w-28"
                      aria-label="Precio de venta"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Quitar"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <div key={line.key} className="grid sm:grid-cols-[1fr_8rem_auto] gap-3 items-end rounded-lg border p-3">
                  <div className="sm:col-span-3 space-y-2">
                    <Label htmlFor={`name-${line.key}`}>Pieza libre (no está en inventario)</Label>
                    <Textarea
                      id={`name-${line.key}`}
                      rows={2}
                      placeholder="Ej: guardafango LH + bisagras de capot"
                      value={line.name}
                      onChange={(e) => patch(line.key, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auto de origen</Label>
                    <Select
                      value={line.sourceVehicleId || NONE}
                      items={vehicleItems}
                      onValueChange={(v) => patch(line.key, { sourceVehicleId: !v || v === NONE ? "" : v })}
                    >
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
                    <Label htmlFor={`price-${line.key}`}>Precio (USD)</Label>
                    <Input
                      id={`price-${line.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.priceSold}
                      onChange={(e) => patch(line.key, { priceSold: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Quitar"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ),
            )}
            {lines.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no has agregado piezas.</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((p) => [...p, { key: nextKey.current++, name: "", sourceVehicleId: "", priceSold: "" }])
              }
            >
              <Plus className="size-4" />
              Agregar pieza libre
            </Button>
            <div className="text-lg font-semibold">Total: {formatCurrency(total)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la venta</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
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
            <Label htmlFor="saleDate">Fecha y hora</Label>
            <Input id="saleDate" name="saleDate" type="datetime-local" defaultValue={defaultDate} required />
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
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" render={<Link href="/ventas" />} nativeButton={false}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending || !valid}>
          {isPending ? "Registrando…" : "Registrar venta"}
        </Button>
      </div>
    </form>
  );
}
