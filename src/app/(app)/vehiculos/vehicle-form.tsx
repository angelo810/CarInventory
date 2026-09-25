"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Minus, Plus, Search, Trash2 } from "lucide-react";
import { createVehicle } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Zone = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "DOCUMENTS" | "SCRAP" | "COMPLETE";
type CatalogItem = { id: string; name: string; zone: Zone; kept: boolean };
type Extra = { key: number; name: string; zone: Zone; qty: string; addToCatalog: boolean };

const ZONES: { value: Zone; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "DOCUMENTS", label: "Documentos" },
  { value: "SCRAP", label: "Chatarra" },
  { value: "COMPLETE", label: "Completo" },
];

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function VehicleForm({ catalog }: { catalog: CatalogItem[] }) {
  const [state, formAction, isPending] = useActionState(createVehicle, undefined);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [zone, setZone] = useState<Zone>("INTERIOR");
  const [search, setSearch] = useState("");
  const [showAllExterior, setShowAllExterior] = useState(false);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const byZone = useMemo(() => {
    const map: Record<Zone, CatalogItem[]> = {
      INTERIOR: [],
      MECHANICAL: [],
      EXTERIOR: [],
      DOCUMENTS: [],
      SCRAP: [],
      COMPLETE: [],
    };
    for (const item of catalog) map[item.zone].push(item);
    return map;
  }, [catalog]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return byZone[zone].filter(
      (i) => (zone !== "EXTERIOR" || showAllExterior || i.kept || (qty[i.id] ?? 0) > 0) && (!q || i.name.toLowerCase().includes(q)),
    );
  }, [byZone, zone, search, showAllExterior, qty]);

  const hiddenExteriorCount = byZone.EXTERIOR.filter((i) => !i.kept).length;

  function setItemQty(id: string, value: number) {
    setQty((prev) => {
      const next = { ...prev };
      const v = Math.max(0, Math.min(50, Math.floor(value) || 0));
      if (v === 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  function markVisible(value: number) {
    setQty((prev) => {
      const next = { ...prev };
      for (const item of visible) {
        if (value === 0) delete next[item.id];
        else if (!next[item.id]) next[item.id] = value;
      }
      return next;
    });
  }

  const zoneTotals = useMemo(() => {
    const totals: Record<Zone, number> = {
      INTERIOR: 0,
      MECHANICAL: 0,
      EXTERIOR: 0,
      DOCUMENTS: 0,
      SCRAP: 0,
      COMPLETE: 0,
    };
    for (const item of catalog) totals[item.zone] += qty[item.id] ?? 0;
    for (const e of extras) if (e.name.trim()) totals[e.zone] += Math.max(1, Number(e.qty) || 1);
    return totals;
  }, [catalog, qty, extras]);
  const grandTotal =
    zoneTotals.INTERIOR +
    zoneTotals.MECHANICAL +
    zoneTotals.EXTERIOR +
    zoneTotals.DOCUMENTS +
    zoneTotals.SCRAP +
    zoneTotals.COMPLETE;

  const checklistJson = JSON.stringify(Object.entries(qty));
  const extrasJson = JSON.stringify(
    extras
      .filter((e) => e.name.trim())
      .map((e) => ({ name: e.name, zone: e.zone, qty: Math.max(1, Number(e.qty) || 1), addToCatalog: e.addToCatalog })),
  );

  function patchExtra(key: number, changes: Partial<Extra>) {
    setExtras((prev) => prev.map((e) => (e.key === key ? { ...e, ...changes } : e)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="checklist" value={checklistJson} />
      <input type="hidden" name="extras" value={extrasJson} />

      <Card>
        <CardHeader>
          <CardTitle>Datos del vehículo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Marca" name="brand" error={state?.fieldErrors?.brand} required />
          <Field label="Modelo" name="model" error={state?.fieldErrors?.model} required />
          <Field label="Año" name="year" type="number" error={state?.fieldErrors?.year} required />
          <Field label="Motor" name="engine" error={state?.fieldErrors?.engine} />
          <Field label="VIN (opcional)" name="vin" error={state?.fieldErrors?.vin} />
          <Field label="Estado general" name="condition" error={state?.fieldErrors?.condition} />
          <Field label="Fecha de compra" name="purchaseDate" type="date" error={state?.fieldErrors?.purchaseDate} required />
          <Field
            label="Costo de compra (USD)"
            name="purchaseCost"
            type="number"
            step="0.01"
            error={state?.fieldErrors?.purchaseCost}
            required
          />
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Piezas que trae el vehículo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Toca una pieza para marcar que la tiene (1 unidad) y sube el número si trae más. Lo que no marques no se registra.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={zone} onValueChange={(v) => setZone(v as Zone)}>
            <TabsList>
              {ZONES.map((z) => (
                <TabsTrigger key={z.value} value={z.value}>
                  {z.label}
                  <span className="ml-1.5 text-xs text-muted-foreground">{zoneTotals[z.value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en esta lista…"
                className="pl-8"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => markVisible(1)}>
              Marcar todas las visibles
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => markVisible(0)}>
              Quitar todas
            </Button>
            {zone === "EXTERIOR" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                <input
                  type="checkbox"
                  checked={showAllExterior}
                  onChange={(e) => setShowAllExterior(e.target.checked)}
                />
                Mostrar también las que normalmente no se guardan ({hiddenExteriorCount})
              </label>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto rounded-lg border divide-y">
            {visible.map((item) => {
              const n = qty[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", n > 0 && "bg-emerald-50 dark:bg-emerald-950/30")}
                >
                  <button
                    type="button"
                    onClick={() => setItemQty(item.id, n > 0 ? 0 : 1)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded border",
                        n > 0 ? "border-emerald-600 bg-emerald-600 text-white" : "border-input",
                      )}
                    >
                      {n > 0 && <Check className="size-3.5" />}
                    </span>
                    <span className={cn(n === 0 && "text-muted-foreground")}>{item.name}</span>
                  </button>
                  {n > 0 && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon-xs" onClick={() => setItemQty(item.id, n - 1)}>
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={n}
                        onChange={(e) => setItemQty(item.id, Number(e.target.value))}
                        className="h-6 w-12 px-1 text-center"
                      />
                      <Button type="button" variant="outline" size="icon-xs" onClick={() => setItemQty(item.id, n + 1)}>
                        <Plus />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No hay piezas que coincidan.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Piezas extra</CardTitle>
          <p className="text-sm text-muted-foreground">
            Si el vehículo trae una pieza que no está en la lista, agrégala aquí.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {extras.map((e) => (
            <div key={e.key} className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Nombre de la pieza"
                value={e.name}
                onChange={(ev) => patchExtra(e.key, { name: ev.target.value })}
                className="flex-1 min-w-48"
              />
              <select
                value={e.zone}
                onChange={(ev) => patchExtra(e.key, { zone: ev.target.value as Zone })}
                className={selectClass}
              >
                {ZONES.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                max={50}
                value={e.qty}
                onChange={(ev) => patchExtra(e.key, { qty: ev.target.value })}
                className="w-16"
                title="Cantidad"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={e.addToCatalog}
                  onChange={(ev) => patchExtra(e.key, { addToCatalog: ev.target.checked })}
                />
                Agregar a la lista
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Quitar"
                onClick={() => setExtras((prev) => prev.filter((x) => x.key !== e.key))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setExtras((prev) => [...prev, { key: nextKey, name: "", zone, qty: "1", addToCatalog: false }]);
              setNextKey((k) => k + 1);
            }}
          >
            <Plus className="size-4" />
            Agregar pieza extra
          </Button>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="sticky bottom-0 -mx-4 md:-mx-6 flex items-center justify-between gap-4 border-t bg-background/95 px-4 md:px-6 py-3 backdrop-blur">
        <p className="text-sm">
          <span className="font-semibold">{grandTotal}</span> piezas a registrar
          <span className="text-muted-foreground">
            {" "}
            · Interior {zoneTotals.INTERIOR} · Mecánico {zoneTotals.MECHANICAL} · Exterior {zoneTotals.EXTERIOR} ·
            Documentos {zoneTotals.DOCUMENTS} · Chatarra {zoneTotals.SCRAP} · Completo {zoneTotals.COMPLETE}
          </span>
        </p>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar vehículo"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  error,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  error?: string[];
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} required={required} />
      {error && <p className="text-sm text-destructive">{error[0]}</p>}
    </div>
  );
}
