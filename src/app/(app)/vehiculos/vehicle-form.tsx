"use client";

import { useActionState } from "react";
import { createVehicle } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export function VehicleForm() {
  const [state, formAction, isPending] = useActionState(createVehicle, undefined);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Marca" name="brand" error={state?.fieldErrors?.brand} required />
          <Field label="Modelo" name="model" error={state?.fieldErrors?.model} required />
          <Field label="Año" name="year" type="number" error={state?.fieldErrors?.year} required />
          <Field label="Motor" name="engine" error={state?.fieldErrors?.engine} />
          <Field label="VIN (opcional)" name="vin" error={state?.fieldErrors?.vin} />
          <Field label="Estado general" name="condition" error={state?.fieldErrors?.condition} />
          <Field
            label="Fecha de compra"
            name="purchaseDate"
            type="date"
            error={state?.fieldErrors?.purchaseDate}
            required
          />
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
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          {state?.error && (
            <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>
          )}

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar vehículo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
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
