"use client";

import { useActionState } from "react";
import { updatePart } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { partConditionLabels, partStatusLabels } from "@/lib/labels";
import { PartCondition, PartStatus } from "@/generated/prisma/enums";
import { toast } from "sonner";
import { useEffect } from "react";

export function PartEditForm({
  partId,
  condition,
  status,
  location,
  cost,
  price,
  notes,
}: {
  partId: string;
  condition: PartCondition;
  status: PartStatus;
  location: string;
  cost: string;
  price: string;
  notes: string;
}) {
  const updateWithId = updatePart.bind(null, partId);
  const [state, formAction, isPending] = useActionState(updateWithId, undefined);

  useEffect(() => {
    if (state && !state.error && !state.fieldErrors) {
      toast.success("Pieza actualizada");
    }
  }, [state]);

  return (
    <form action={formAction} className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="condition">Condición</Label>
        <Select name="condition" defaultValue={condition} items={partConditionLabels}>
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
        <Select name="status" defaultValue={status} items={partStatusLabels}>
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
        <Label htmlFor="location">Ubicación</Label>
        <Input id="location" name="location" defaultValue={location} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cost">Costo real (USD)</Label>
        <Input id="cost" name="cost" type="number" step="0.01" defaultValue={cost} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="price">Precio de venta (USD)</Label>
        <Input id="price" name="price" type="number" step="0.01" defaultValue={price} required />
      </div>
      <div className="sm:col-span-2 space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={notes} />
      </div>

      {state?.error && <p className="sm:col-span-2 text-sm text-destructive">{state.error}</p>}

      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
