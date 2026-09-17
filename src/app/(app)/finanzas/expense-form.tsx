"use client";

import { useActionState, useEffect } from "react";
import { createExpense } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { expenseCategoryLabels } from "@/lib/labels";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { toast } from "sonner";

type VehicleOption = { id: string; brand: string; model: string; year: number };

export function ExpenseForm({ vehicles }: { vehicles: VehicleOption[] }) {
  const [state, formAction, isPending] = useActionState(createExpense, undefined);

  useEffect(() => {
    if (state && !state.error) {
      toast.success("Gasto registrado");
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4" key={state && !state.error ? Math.random() : "form"}>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select name="category" defaultValue={ExpenseCategory.OTHER} items={expenseCategoryLabels}>
            <SelectTrigger className="w-full" id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ExpenseCategory).map((c) => (
                <SelectItem key={c} value={c}>
                  {expenseCategoryLabels[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input id="description" name="description" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Monto (USD)</Label>
          <Input id="amount" name="amount" type="number" step="0.01" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceVehicleId">Vehículo relacionado (opcional)</Label>
          <Select
            name="sourceVehicleId"
            items={Object.fromEntries(vehicles.map((v) => [v.id, `${v.brand} ${v.model} (${v.year})`]))}
          >
            <SelectTrigger className="w-full" id="sourceVehicleId">
              <SelectValue placeholder="Ninguno" />
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
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Registrar gasto"}
        </Button>
      </div>
    </form>
  );
}
