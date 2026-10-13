"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateVehicle } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export type VehicleEditDefaults = {
  brand: string;
  model: string;
  year: number;
  color: string;
  plate: string;
  condition: string;
  purchaseDate: string; // YYYY-MM-DD
  purchaseCost: string;
  notes: string;
};

export function VehicleEditForm({ vehicleId, defaults }: { vehicleId: string; defaults: VehicleEditDefaults }) {
  const [state, formAction, isPending] = useActionState(updateVehicle.bind(null, vehicleId), undefined);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
          <Field label="Marca" name="brand" defaultValue={defaults.brand} error={state?.fieldErrors?.brand} required />
          <Field label="Modelo" name="model" defaultValue={defaults.model} error={state?.fieldErrors?.model} required />
          <Field label="Año" name="year" type="number" defaultValue={String(defaults.year)} error={state?.fieldErrors?.year} required />
          <Field label="Color" name="color" defaultValue={defaults.color} error={state?.fieldErrors?.color} />
          <Field label="Placa (opcional)" name="plate" defaultValue={defaults.plate} error={state?.fieldErrors?.plate} />
          <Field label="Estado general" name="condition" defaultValue={defaults.condition} error={state?.fieldErrors?.condition} />
          <Field
            label="Fecha de compra"
            name="purchaseDate"
            type="date"
            defaultValue={defaults.purchaseDate}
            error={state?.fieldErrors?.purchaseDate}
            required
          />
          <Field
            label="Costo de compra (USD)"
            name="purchaseCost"
            type="number"
            step="0.01"
            defaultValue={defaults.purchaseCost}
            error={state?.fieldErrors?.purchaseCost}
            required
          />
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={defaults.notes} />
          </div>
        </CardContent>
      </Card>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button variant="outline" render={<Link href={`/vehiculos/${vehicleId}`} />} nativeButton={false}>
          Cancelar
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
  defaultValue,
  error,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue: string;
  error?: string[];
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} required={required} />
      {error && <p className="text-sm text-destructive">{error[0]}</p>}
    </div>
  );
}
