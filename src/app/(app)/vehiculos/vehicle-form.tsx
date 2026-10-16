"use client";

import { useActionState, useMemo, useState } from "react";
import { createVehicle } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// "Optra 5" -> { base: "Optra", num: 5 }. Si el modelo no termina en número, no es parte de una serie.
function parseModelSeries(model: string): { base: string; num: number } | null {
  const m = model.trim().match(/^(.*?)\s+(\d+)$/);
  if (!m) return null;
  return { base: m[1].trim(), num: Number(m[2]) };
}

/**
 * Paso 1: se guardan solo los datos del vehículo. Las piezas que trae se asignan después, en la página
 * del vehículo (paso 2), a donde se llega al guardar.
 */
export function VehicleForm({ existingVehicles }: { existingVehicles: { brand: string; model: string }[] }) {
  const [state, formAction, isPending] = useActionState(createVehicle, undefined);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");

  const seriesMax = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of existingVehicles) {
      const parsed = parseModelSeries(v.model);
      if (!parsed) continue;
      const key = `${v.brand.trim().toLowerCase()}|${parsed.base.toLowerCase()}`;
      map.set(key, Math.max(map.get(key) ?? 0, parsed.num));
    }
    return map;
  }, [existingVehicles]);

  function applyModelSuggestion(nextBrand: string, nextModel: string) {
    const b = nextBrand.trim().toLowerCase();
    const m = nextModel.trim();
    if (!b || !m || parseModelSeries(m)) return; // ya tiene su propio número, no tocar
    const max = seriesMax.get(`${b}|${m.toLowerCase()}`);
    if (max != null) setModel(`${m} ${max + 1}`);
  }

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del vehículo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand">Marca</Label>
            <Input
              id="brand"
              name="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onBlur={() => applyModelSuggestion(brand, model)}
              required
            />
            {state?.fieldErrors?.brand && <p className="text-sm text-destructive">{state.fieldErrors.brand[0]}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Modelo</Label>
            <Input
              id="model"
              name="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => applyModelSuggestion(brand, model)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Si ya tienes {brand || "esta marca"} {model || "este modelo"} registrado, se numera solo (ej. &quot;Optra
              6&quot;).
            </p>
            {state?.fieldErrors?.model && <p className="text-sm text-destructive">{state.fieldErrors.model[0]}</p>}
          </div>
          <Field label="Año" name="year" type="number" error={state?.fieldErrors?.year} required />
          <Field label="Color" name="color" error={state?.fieldErrors?.color} />
          <Field label="Placa (opcional)" name="plate" error={state?.fieldErrors?.plate} />
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Al guardar pasas a la página del vehículo, donde le asignas las piezas que trae.
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
