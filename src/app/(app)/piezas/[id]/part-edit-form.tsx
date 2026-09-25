"use client";

import { useActionState, useEffect, useState } from "react";
import { updatePart } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { partConditionLabels, partStatusLabels } from "@/lib/labels";
import { PartCondition, PartStatus } from "@/generated/prisma/enums";
import { PartTypePicker, type PartTypeOption, type ZoneKey } from "@/components/part-type-picker";
import { toast } from "sonner";

type VehicleOption = { id: string; brand: string; model: string; year: number };

export function PartEditForm({
  partId,
  partTypeId,
  partTypeZone,
  partTypes,
  sourceVehicleId,
  vehicles,
  condition,
  status,
  location,
  cost,
  price,
  notes,
}: {
  partId: string;
  partTypeId: string;
  partTypeZone: ZoneKey;
  partTypes: PartTypeOption[];
  sourceVehicleId: string;
  vehicles: VehicleOption[];
  condition: PartCondition;
  status: PartStatus;
  location: string;
  cost: string;
  price: string;
  notes: string;
}) {
  const updateWithId = updatePart.bind(null, partId);
  const [state, formAction, isPending] = useActionState(updateWithId, undefined);
  const [selectedTypeId, setSelectedTypeId] = useState(partTypeId);

  useEffect(() => {
    if (state && !state.error && !state.fieldErrors) {
      toast.success("Pieza actualizada");
    }
  }, [state]);

  // Tras guardar, la página vuelve a traer los datos y se los pasa a este mismo formulario
  // montado (no navega a otra ruta). Si un campo cambió de verdad, esta key cambia y React
  // remonta el formulario entero con los valores nuevos, en vez de intentarle cambiar el
  // "defaultValue" a un campo no controlado ya inicializado (lo que Base UI no permite).
  const formKey = [partTypeId, sourceVehicleId, condition, status, location, cost, price, notes].join("|");

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <PartTypePicker
        partTypes={partTypes}
        value={selectedTypeId}
        onChange={setSelectedTypeId}
        initialZone={partTypeZone}
        label="Pieza (tipo de catálogo)"
      />
      <input type="hidden" name="partTypeId" value={selectedTypeId} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sourceVehicleId">Vehículo de origen</Label>
          <Select
            name="sourceVehicleId"
            defaultValue={sourceVehicleId}
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
          <Label htmlFor="condition">Condición</Label>
          <Select key={condition} name="condition" defaultValue={condition} items={partConditionLabels}>
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
          <Select key={status} name="status" defaultValue={status} items={partStatusLabels}>
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
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
