"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageOff } from "lucide-react";
import { toast } from "sonner";
import { assignPartToVehicles } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartTypePicker, type PartTypeOption } from "@/components/part-type-picker";
import { partImageSrc } from "@/lib/part-image";

type Cond = "USED_GOOD" | "FOR_PARTS";
type Counts = { available: number; sold: number; other: number };
export type PartCounts = Record<string, Record<string, Counts>>;
type TypeWithImage = PartTypeOption & { imageUrl: string | null };
type Row = { qty: number; condition: Cond };

const COND_OPTIONS = [
  ["USED_GOOD", "Buen estado"],
  ["FOR_PARTS", "Rota"],
] as const;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AssignByPart({
  partTypes,
  vehicles,
  counts,
}: {
  partTypes: TypeWithImage[];
  vehicles: { id: string; label: string }[];
  counts: PartCounts;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typeId, setTypeId] = useState("");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [search, setSearch] = useState("");
  const [hideHave, setHideHave] = useState(true);

  const selected = partTypes.find((t) => t.id === typeId);

  const visible = useMemo(() => {
    const tokens = norm(search).split(/\s+/).filter(Boolean);
    const byVehicle = counts[typeId] ?? {};
    return vehicles
      .filter((v) => tokens.every((t) => norm(v.label).includes(t)))
      .filter((v) => {
        if (!hideHave || !typeId) return true;
        const c = byVehicle[v.id];
        const has = !!c && c.available + c.sold + c.other > 0;
        return !has || (rows[v.id]?.qty ?? 0) > 0;
      });
  }, [vehicles, search, hideHave, typeId, counts, rows]);

  const hiddenCount = useMemo(() => {
    const byVehicle = counts[typeId] ?? {};
    return vehicles.filter((v) => {
      const c = byVehicle[v.id];
      return !!c && c.available + c.sold + c.other > 0;
    }).length;
  }, [vehicles, typeId, counts]);

  const pending = Object.entries(rows).filter(([, r]) => r.qty > 0);
  const totalUnits = pending.reduce((sum, [, r]) => sum + r.qty, 0);

  function setRow(vehicleId: string, patch: Partial<Row>) {
    setRows((prev) => {
      const cur = prev[vehicleId] ?? { qty: 0, condition: "USED_GOOD" as Cond };
      return { ...prev, [vehicleId]: { ...cur, ...patch } };
    });
  }

  function chooseType(id: string) {
    setTypeId(id);
    setRows({});
    setSearch("");
  }

  function save() {
    if (!selected || pending.length === 0) return;
    const payload = JSON.stringify(
      pending.map(([vehicleId, r]) => ({ vehicleId, qty: r.qty, condition: r.condition })),
    );
    startTransition(async () => {
      const result = await assignPartToVehicles(selected.id, payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const n = result.created ?? 0;
      toast.success(`${n} unidad${n === 1 ? "" : "es"} de "${selected.name}" agregada${n === 1 ? "" : "s"}.`);
      setRows({});
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Elige la pieza</CardTitle>
        </CardHeader>
        <CardContent>
          <PartTypePicker
            partTypes={partTypes}
            value={typeId}
            onChange={chooseType}
            label="Escribe para buscar y toca la pieza"
          />
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>2. ¿Cuántas trae cada vehículo?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border p-3">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30 text-muted-foreground">
                {selected.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partImageSrc(selected.id, selected.imageUrl) ?? ""}
                    alt={selected.name}
                    className="size-full object-contain"
                  />
                ) : (
                  <ImageOff className="size-6" />
                )}
              </div>
              <div>
                <p className="text-base font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.imageUrl
                    ? "Confirma con la foto que es esta pieza."
                    : "Esta pieza aún no tiene foto (se sube en Piezas → Organizar tipos)."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vehículo…"
                className="max-w-xs"
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={hideHave} onChange={(e) => setHideHave(e.target.checked)} />
                Ocultar los que ya la tienen ({hiddenCount})
              </label>
            </div>

            <div className="max-h-[32rem] divide-y overflow-y-auto rounded-lg border">
              {visible.map((v) => {
                const c = counts[typeId]?.[v.id];
                const r = rows[v.id] ?? { qty: 0, condition: "USED_GOOD" as Cond };
                return (
                  <div
                    key={v.id}
                    className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${r.qty > 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}
                  >
                    <div className="min-w-48 flex-1">
                      <p>{v.label}</p>
                      {c && (
                        <p className="text-xs text-muted-foreground">
                          Ya tiene: {c.available} disponible{c.available === 1 ? "" : "s"}
                          {c.sold > 0 && ` · ${c.sold} vendida${c.sold === 1 ? "" : "s"}`}
                        </p>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Agregar</span>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={r.qty}
                        onChange={(e) =>
                          setRow(v.id, { qty: Math.max(0, Math.min(50, Math.floor(Number(e.target.value)) || 0)) })
                        }
                        className="h-7 w-16 px-1.5 text-center"
                      />
                    </label>
                    <div className="flex gap-1">
                      {COND_OPTIONS.map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          size="xs"
                          disabled={r.qty === 0}
                          variant={r.condition === value ? "default" : "outline"}
                          onClick={() => setRow(v.id, { condition: value })}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No hay vehículos para mostrar.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {totalUnits > 0
                  ? `${totalUnits} unidad${totalUnits === 1 ? "" : "es"} en ${pending.length} vehículo${pending.length === 1 ? "" : "s"}`
                  : "Escribe la cantidad en los vehículos que la traen."}
              </p>
              <Button type="button" disabled={isPending || totalUnits === 0} onClick={save}>
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
