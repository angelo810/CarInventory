"use client";

import { useActionState, useState } from "react";
import { createPart } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Check, Plus, Trash2 } from "lucide-react";
import { partConditionLabels, partStatusLabels } from "@/lib/labels";
import { PartCondition, PartStatus } from "@/generated/prisma/enums";

type ZoneKey = "INTERIOR" | "MECHANICAL" | "EXTERIOR" | "OTHER";
const ZONES: { value: Exclude<ZoneKey, "OTHER">; label: string }[] = [
  { value: "INTERIOR", label: "Interior" },
  { value: "MECHANICAL", label: "Mecánico" },
  { value: "EXTERIOR", label: "Exterior" },
];

type PartTypeOption = { id: string; name: string; category: string; zone: ZoneKey | null };
type Category = { id: string; name: string };
type VehicleOption = { id: string; brand: string; model: string; year: number };

type CompatRow = { brand: string; model: string; yearFrom: string; yearTo: string };

export function PartForm({
  partTypes,
  categories,
  vehicles,
  defaultVehicleId,
}: {
  partTypes: PartTypeOption[];
  categories: Category[];
  vehicles: VehicleOption[];
  defaultVehicleId?: string;
}) {
  const [state, formAction, isPending] = useActionState(createPart, undefined);
  const [mode, setMode] = useState<"existing" | "new">(partTypes.length ? "existing" : "new");
  const [partTypeId, setPartTypeId] = useState("");
  const [zone, setZone] = useState<ZoneKey>("INTERIOR");
  const [filter, setFilter] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tokens = norm(filter).split(/\s+/).filter(Boolean);
  const visible = partTypes
    .filter((pt) => (zone === "OTHER" ? !pt.zone : pt.zone === zone))
    .filter((pt) => {
      const n = norm(pt.name);
      return tokens.every((t) => n.includes(t));
    });
  const selected = partTypes.find((pt) => pt.id === partTypeId);
  const [compatRows, setCompatRows] = useState<CompatRow[]>([
    { brand: "", model: "", yearFrom: "", yearTo: "" },
  ]);

  const compatibilitiesJson = JSON.stringify(
    compatRows
      .filter((r) => r.brand && r.model && r.yearFrom && r.yearTo)
      .map((r) => ({
        brand: r.brand,
        model: r.model,
        yearFrom: Number(r.yearFrom),
        yearTo: Number(r.yearTo),
      })),
  );

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tipo de pieza</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
            <TabsList>
              <TabsTrigger value="existing">Tipo existente</TabsTrigger>
              <TabsTrigger value="new">Crear nuevo tipo</TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="space-y-2 pt-2">
              <Label>1. ¿De qué modelo es la pieza?</Label>
              <div className="flex flex-wrap gap-2">
                {ZONES.map((z) => (
                  <Button
                    key={z.value}
                    type="button"
                    size="sm"
                    variant={zone === z.value ? "default" : "outline"}
                    onClick={() => {
                      setZone(z.value);
                      setFilter("");
                    }}
                  >
                    {z.label}
                    <span className="ml-1 text-xs opacity-70">
                      {partTypes.filter((pt) => pt.zone === z.value).length}
                    </span>
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={zone === "OTHER" ? "default" : "outline"}
                  onClick={() => {
                    setZone("OTHER");
                    setFilter("");
                  }}
                >
                  Otras
                  <span className="ml-1 text-xs opacity-70">{partTypes.filter((pt) => !pt.zone).length}</span>
                </Button>
              </div>

              <Label className="pt-2">2. Escribe para buscar la pieza</Label>
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={`Buscar en ${zone === "OTHER" ? "otras" : ZONES.find((z) => z.value === zone)?.label.toLowerCase()}… (ej: faro, lh, espejo)`}
                autoComplete="off"
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {visible.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setPartTypeId(pt.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                      pt.id === partTypeId ? "bg-muted font-medium" : ""
                    }`}
                  >
                    <span>{pt.name}</span>
                    {pt.id === partTypeId && <Check className="size-4" />}
                  </button>
                ))}
                {visible.length === 0 && (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Sin resultados. Usa &quot;Crear nuevo tipo&quot; si no está en la lista.
                  </p>
                )}
              </div>
              <p className="text-sm">
                {selected ? (
                  <>
                    Seleccionada: <strong>{selected.name}</strong>
                  </>
                ) : (
                  <span className="text-muted-foreground">Aún no has elegido una pieza.</span>
                )}
              </p>
              {mode === "existing" && <input type="hidden" name="partTypeId" value={partTypeId} />}
            </TabsContent>
            <TabsContent value="new" className="space-y-4 pt-2">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newTypeName">Nombre de la pieza</Label>
                  <Input id="newTypeName" name="newTypeName" placeholder="Ej: Alternador" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newTypeCategoryId">Categoría</Label>
                  <Select
                    name="newTypeCategoryId"
                    items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
                  >
                    <SelectTrigger className="w-full" id="newTypeCategoryId">
                      <SelectValue placeholder="Selecciona categoría…" />
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="newTypeDescription">Descripción (opcional)</Label>
                <Textarea id="newTypeDescription" name="newTypeDescription" rows={2} />
              </div>

              <div className="space-y-2">
                <Label>Vehículos compatibles</Label>
                {compatRows.map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    <Input
                      placeholder="Marca"
                      value={row.brand}
                      onChange={(e) => updateRow(i, "brand", e.target.value)}
                      className="w-32"
                    />
                    <Input
                      placeholder="Modelo"
                      value={row.model}
                      onChange={(e) => updateRow(i, "model", e.target.value)}
                      className="w-32"
                    />
                    <Input
                      placeholder="Año desde"
                      type="number"
                      value={row.yearFrom}
                      onChange={(e) => updateRow(i, "yearFrom", e.target.value)}
                      className="w-28"
                    />
                    <Input
                      placeholder="Año hasta"
                      type="number"
                      value={row.yearTo}
                      onChange={(e) => updateRow(i, "yearTo", e.target.value)}
                      className="w-28"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(i)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addRow}>
                  <Plus className="size-4" />
                  Agregar compatibilidad
                </Button>
              </div>
              <input type="hidden" name="compatibilities" value={compatibilitiesJson} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la unidad</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sourceVehicleId">Vehículo de origen</Label>
            <Select
              name="sourceVehicleId"
              defaultValue={defaultVehicleId}
              items={Object.fromEntries(vehicles.map((v) => [v.id, `${v.brand} ${v.model} (${v.year})`]))}
            >
              <SelectTrigger className="w-full" id="sourceVehicleId">
                <SelectValue placeholder="Sin vehículo asociado" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.brand} {v.model} ({v.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación en bodega</Label>
            <Input id="location" name="location" placeholder="Ej: Estante A-3" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition">Condición</Label>
            <Select name="condition" defaultValue={PartCondition.USED_GOOD} items={partConditionLabels}>
              <SelectTrigger className="w-full" id="condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PartCondition).map((c) => (
                  <SelectItem key={c} value={c}>
                    {partConditionLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select name="status" defaultValue={PartStatus.AVAILABLE} items={partStatusLabels}>
              <SelectTrigger className="w-full" id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PartStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {partStatusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost">Costo real (USD)</Label>
            <Input id="cost" name="cost" type="number" step="0.01" defaultValue="0" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Precio de venta (USD)</Label>
            <Input id="price" name="price" type="number" step="0.01" required />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar pieza"}
        </Button>
      </div>
    </form>
  );

  function updateRow(index: number, field: keyof CompatRow, value: string) {
    setCompatRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setCompatRows((rows) => [...rows, { brand: "", model: "", yearFrom: "", yearTo: "" }]);
  }

  function removeRow(index: number) {
    setCompatRows((rows) => rows.filter((_, i) => i !== index));
  }
}
