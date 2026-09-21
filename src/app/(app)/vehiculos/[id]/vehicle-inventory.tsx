"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveVehicleInventory } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Zone = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "OTHER";

export type InventoryRow = {
  partTypeId: string;
  name: string;
  zone: Zone;
  kept: boolean;
  available: number;
  sold: number;
  other: number;
  price: number;
};

type Extra = { key: number; name: string; zone: Exclude<Zone, "OTHER">; qty: string; price: string };
type Filter = "all" | "available" | "sold" | "missing";

const ZONES: { value: Zone; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "OTHER", label: "Otras" },
];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "available", label: "Disponibles" },
  { value: "sold", label: "Vendidas" },
  { value: "missing", label: "No las trae" },
];

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function VehicleInventory({ vehicleId, rows }: { vehicleId: string; rows: InventoryRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [edits, setEdits] = useState<Record<string, { qty: number; price: string }>>(() =>
    Object.fromEntries(rows.map((r) => [r.partTypeId, { qty: r.available, price: r.price ? String(r.price) : "" }])),
  );
  const [zone, setZone] = useState<Zone>("INTERIOR");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showAllExterior, setShowAllExterior] = useState(false);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const dirty = useMemo(
    () =>
      rows.filter((r) => {
        const e = edits[r.partTypeId];
        return e.qty !== r.available || (e.qty > 0 && Number(e.price || 0) !== r.price);
      }),
    [rows, edits],
  );
  const validExtras = extras.filter((e) => e.name.trim());
  const pendingChanges = dirty.length + validExtras.length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.zone !== zone) return false;
      const e = edits[r.partTypeId];
      if (zone === "EXTERIOR" && !showAllExterior && !r.kept && e.qty === 0 && r.sold === 0) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filter === "available") return e.qty > 0;
      if (filter === "sold") return r.sold > 0;
      if (filter === "missing") return e.qty === 0 && r.sold === 0 && r.other === 0;
      return true;
    });
  }, [rows, edits, zone, search, filter, showAllExterior]);

  const zoneCounts = useMemo(() => {
    const c: Record<Zone, number> = { INTERIOR: 0, MECHANICAL: 0, EXTERIOR: 0, OTHER: 0 };
    for (const r of rows) c[r.zone] += edits[r.partTypeId].qty;
    return c;
  }, [rows, edits]);

  const hiddenExterior = rows.filter((r) => r.zone === "EXTERIOR" && !r.kept).length;

  function setQty(id: string, value: number) {
    const qty = Math.max(0, Math.min(200, Math.floor(value) || 0));
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], qty } }));
  }

  function setPrice(id: string, price: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], price } }));
  }

  function save() {
    const payload = JSON.stringify({
      changes: dirty.map((r) => ({
        partTypeId: r.partTypeId,
        qty: edits[r.partTypeId].qty,
        price: Number(edits[r.partTypeId].price || 0),
      })),
      extras: validExtras.map((e) => ({
        name: e.name,
        zone: e.zone,
        qty: Math.max(1, Number(e.qty) || 1),
        price: Number(e.price || 0),
      })),
    });

    startTransition(async () => {
      const result = await saveVehicleInventory(vehicleId, payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Guardado: ${result.created ?? 0} agregadas, ${result.removed ?? 0} quitadas`);
      setExtras([]);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario de piezas</CardTitle>
        <p className="text-sm text-muted-foreground">
          Toca una pieza para marcar que el auto la tiene. El número son las unidades <b>disponibles</b>; las vendidas
          se muestran aparte y no se pueden quitar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={zone} onValueChange={(v) => setZone(v as Zone)}>
          <TabsList>
            {ZONES.map((z) => (
              <TabsTrigger key={z.value} value={z.value}>
                {z.label}
                <span className="ml-1.5 text-xs text-muted-foreground">{zoneCounts[z.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en esta lista…"
              className="pl-8"
            />
          </div>
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
          {zone === "EXTERIOR" && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
              <input type="checkbox" checked={showAllExterior} onChange={(e) => setShowAllExterior(e.target.checked)} />
              Ver también las que normalmente no se guardan ({hiddenExterior})
            </label>
          )}
        </div>

        <div className="max-h-[32rem] overflow-y-auto rounded-lg border divide-y">
          {visible.map((r) => {
            const e = edits[r.partTypeId];
            const has = e.qty > 0;
            return (
              <div
                key={r.partTypeId}
                className={cn("flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm", has && "bg-emerald-50 dark:bg-emerald-950/30")}
              >
                <button
                  type="button"
                  onClick={() => setQty(r.partTypeId, has ? 0 : 1)}
                  className="flex flex-1 min-w-48 items-center gap-2 text-left"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      has ? "border-emerald-600 bg-emerald-600 text-white" : "border-input",
                    )}
                  >
                    {has && <Check className="size-3.5" />}
                  </span>
                  <span className={cn(!has && r.sold === 0 && "text-muted-foreground")}>{r.name}</span>
                </button>
                {r.sold > 0 && <Badge variant="destructive">{r.sold} vendida{r.sold > 1 ? "s" : ""}</Badge>}
                {r.other > 0 && <Badge variant="secondary">{r.other} reservada{r.other > 1 ? "s" : ""}</Badge>}
                {!has && r.sold === 0 && r.other === 0 && <Badge variant="outline">No la trae</Badge>}
                {has && (
                  <>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon-xs" onClick={() => setQty(r.partTypeId, e.qty - 1)}>
                        <Minus />
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        value={e.qty}
                        onChange={(ev) => setQty(r.partTypeId, Number(ev.target.value))}
                        className="h-6 w-12 px-1 text-center"
                        title="Unidades disponibles"
                      />
                      <Button type="button" variant="outline" size="icon-xs" onClick={() => setQty(r.partTypeId, e.qty + 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={e.price}
                        placeholder="Precio"
                        onChange={(ev) => setPrice(r.partTypeId, ev.target.value)}
                        className="h-6 w-20 px-1.5"
                        title="Precio de venta"
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No hay piezas que coincidan.</p>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Agregar una pieza que no está en la lista</p>
          {extras.map((x) => (
            <div key={x.key} className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Nombre de la pieza"
                value={x.name}
                onChange={(ev) => setExtras((p) => p.map((i) => (i.key === x.key ? { ...i, name: ev.target.value } : i)))}
                className="flex-1 min-w-48"
              />
              <select
                value={x.zone}
                onChange={(ev) =>
                  setExtras((p) => p.map((i) => (i.key === x.key ? { ...i, zone: ev.target.value as Extra["zone"] } : i)))
                }
                className={selectClass}
              >
                {ZONES.filter((z) => z.value !== "OTHER").map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={1}
                value={x.qty}
                onChange={(ev) => setExtras((p) => p.map((i) => (i.key === x.key ? { ...i, qty: ev.target.value } : i)))}
                className="w-16"
                title="Cantidad"
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Precio"
                value={x.price}
                onChange={(ev) => setExtras((p) => p.map((i) => (i.key === x.key ? { ...i, price: ev.target.value } : i)))}
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Quitar"
                onClick={() => setExtras((p) => p.filter((i) => i.key !== x.key))}
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
              setExtras((p) => [
                ...p,
                { key: nextKey, name: "", zone: zone === "OTHER" ? "INTERIOR" : zone, qty: "1", price: "" },
              ]);
              setNextKey((k) => k + 1);
            }}
          >
            <Plus className="size-4" />
            Agregar pieza extra
          </Button>
        </div>

        {pendingChanges > 0 && (
          <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-between gap-4 border-t bg-background/95 px-6 py-3 backdrop-blur">
            <p className="text-sm">
              <span className="font-semibold">{pendingChanges}</span> cambio{pendingChanges > 1 ? "s" : ""} sin guardar
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  setEdits(
                    Object.fromEntries(
                      rows.map((r) => [r.partTypeId, { qty: r.available, price: r.price ? String(r.price) : "" }]),
                    ),
                  );
                  setExtras([]);
                }}
              >
                Descartar
              </Button>
              <Button type="button" disabled={isPending} onClick={save}>
                {isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
